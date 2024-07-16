import {
  busDispatch,
  useEventBus,
} from '@pivanov/event-bus';
import * as PAPI_SIGNER from '@polkadot-api/signer';
import * as PAPI_WS_PROVIDER_WEB from '@polkadot-api/ws-provider/web';
import { shikiToMonaco } from '@shikijs/monaco/index.mjs';
import * as monaco from 'monaco-editor';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getSingletonHighlighter } from 'shiki/index.mjs';

import { snippets } from '@constants/snippets';
import { useStoreUI } from '@stores';
import {
  cn,
  getSearchParam,
  setSearchParam,
} from '@utils/helpers';
import {
  storageExists,
  storageGetItem,
  storageSetItem,
} from '@utils/storage';
import {
  STORAGE_CACHE_NAME,
  STORAGE_PREFIX,
} from '@views/codeEditor/constants';
import {
  formatCode,
  setupAta,
} from '@views/codeEditor/helpers';
import { monacoEditorConfig } from '@views/codeEditor/monaco-editor-config';
import { Progress } from '@views/codeEditor/progress';

import type {
  IEventBusIframeDestroy,
  IEventBusMonacoEditorExecuteSnippet,
  IEventBusMonacoEditorUpdateCursorPosition,
} from '@custom-types/eventBus';

monaco.languages.css.cssDefaults.setOptions({ validate: false });

monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
});

monaco.languages.typescript.typescriptDefaults.addExtraLib(`
  declare const papiDescriptors = {
    dot: unknown,
    rococo: unknown,
    MultiAddress: unknown,
  };
`, 'papiDescriptors.d.ts');

monaco.languages.typescript.typescriptDefaults.addExtraLib(`
  declare module 'polkadot-api/ws-provider/web' {
    export { ${Object.keys(PAPI_WS_PROVIDER_WEB)} } from 'polkadot-api/ws-provider/web';
  }
  declare module 'polkadot-api/signer' {
    export { ${Object.keys(PAPI_SIGNER)} } from 'polkadot-api/signer';
  }
`, 'papi.d.ts');

const compilerOptions: monaco.languages.typescript.CompilerOptions = {
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  allowSyntheticDefaultImports: true,
  allowUmdGlobalAccess: true,
  jsxFactory: 'React.createElement',
  lib: ['esnext', 'dom'],
  skipLibCheck: true,
  isolatedModules: true,
  resolveJsonModule: true,
  verbatimModuleSyntax: true,
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  allowNonTsExtensions: true,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  module: monaco.languages.typescript.ModuleKind.ESNext,
  noEmit: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  esModuleInterop: true,
  jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
  reactNamespace: 'React',
  allowJs: true,
  typeRoots: ['node_modules/@types'],
};

monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOptions);

const checkTheme = async (theme: string) => {
  const currentTheme = theme === 'dark' ? 'github-dark' : 'github-light';
  const highlighter = await getSingletonHighlighter({
    themes: ['github-dark', 'github-light'],
    langs: ['tsx', 'typescript', 'json'],
  });

  shikiToMonaco(highlighter, monaco);
  monaco.editor.setTheme(currentTheme);
};

export const MonacoEditor = () => {
  const refTimeout = useRef<NodeJS.Timeout>();
  const refSnippet = useRef<string>('');
  const refSnippetIndex = useRef<string | undefined>();
  const refMonacoEditorContainer = useRef<HTMLDivElement | null>(null);
  const refMonacoEditor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const refModel = useRef<monaco.editor.ITextModel | null>(null);

  const [isReadOnly, setIsReadOnly] = useState(false);

  const theme = useStoreUI.use.theme?.();

  const triggerValidation = useCallback(async () => {
    if (refModel.current) {
      busDispatch({
        type: '@@-problems-message',
        data: [],
      });

      const worker = await monaco.languages.typescript.getTypeScriptWorker();
      const client = await worker(refModel.current.uri);

      const [syntacticDiagnostics, semanticDiagnostics] = await Promise.all([
        client.getSyntacticDiagnostics(refModel.current.uri.toString()),
        client.getSemanticDiagnostics(refModel.current.uri.toString()),
      ]);

      const allDiagnostics = [...syntacticDiagnostics, ...semanticDiagnostics];

      const markers = allDiagnostics.map((diag) => {
        const startPos = refModel.current!.getPositionAt(diag.start || 0);
        const endPos = refModel.current!.getPositionAt((diag.start || 0) + (diag.length || 0));

        return {
          severity: monaco.MarkerSeverity.Error,
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column,
          message:
            diag.code === 2307
              ? 'Unable to compile due to a missing module. Please ensure all modules are installed and properly configured.'
              : typeof diag.messageText === 'string'
                ? diag.messageText
                : diag.messageText.messageText,
        };
      });

      monaco.editor.setModelMarkers(refModel.current, 'typescript', markers);

      setTimeout(() => {
        busDispatch({
          type: '@@-problems-message',
          data: markers,
        });
      }, 40);
    }
  }, []);

  const fetchType = setupAta(
    (code, path) => {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(code, `file://${path}`);
    },
    () => {
      void checkTheme(theme);
      void triggerValidation();
    },
    () => {},
    (userFacingMessage, error) => {
      console.error('Custom error handling:', userFacingMessage, error);
    },
    (progress) => {
      busDispatch({
        type: '@@-monaco-editor-types-progress',
        data: progress,
      });
    },
  );

  const createNewModel = (value: string) => {
    refModel.current?.dispose();
    const modelUri = monaco.Uri.parse('file:///main-script.tsx');
    refModel.current = monaco.editor.createModel(value, 'typescript', modelUri);
    refMonacoEditor.current?.setModel(refModel.current);

    refMonacoEditor.current?.focus();
    void triggerValidation();

    busDispatch({
      type: '@@-monaco-editor-update-code',
      data: value,
    });

    void fetchType(refSnippet.current);
  };

  const loadSnippet = useCallback(async (snippetIndex: number | null) => {
    clearTimeout(refTimeout.current);

    busDispatch({
      type: '@@-problems-message',
      data: [],
    });

    busDispatch({
      type: '@@-console-message-reset',
    });

    busDispatch({
      type: '@@-monaco-editor-types-progress',
      data: 0,
    });

    let code = 'console.log("Hello, World!");';
    if (!!snippetIndex) {
      const selectedCodeSnippet = snippets.find((f) => f.id === snippetIndex) || snippets[0];
      refSnippetIndex.current = String(selectedCodeSnippet.id);

      const isTempVersionExist = await storageExists(STORAGE_CACHE_NAME, `${STORAGE_PREFIX}-${snippetIndex}`);
      code = selectedCodeSnippet.code;

      if (isTempVersionExist) {
        const existingCode = await storageGetItem<string>(STORAGE_CACHE_NAME, `${STORAGE_PREFIX}-${snippetIndex}`);
        code = existingCode || code;
      }

      setSearchParam('s', snippetIndex);
    }

    refSnippet.current = await formatCode(code);
    createNewModel(refSnippet.current);

    busDispatch({
      type: '@@-monaco-editor-show-preview',
      data: refSnippet.current.includes('createRoot'),
    });

    refTimeout.current = setTimeout(async () => {
      busDispatch({
        type: '@@-monaco-editor-hide-loading',
      });
    }, 400);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateMonacoCursorPositon = useCallback((currentPosition: monaco.Position) => {
    if (currentPosition) {
      refMonacoEditor.current?.setPosition(currentPosition);
      refMonacoEditor.current?.revealPositionInCenter(currentPosition);
      refMonacoEditor.current?.focus();
    }
  }, []);

  useEffect(() => {
    const snippetIndex = getSearchParam('s');
    void loadSnippet(!!snippetIndex ? Number(snippetIndex) : null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void checkTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (refMonacoEditorContainer.current && !refMonacoEditor.current) {
      refMonacoEditor.current = monaco.editor.create(refMonacoEditorContainer.current, {
        ...monacoEditorConfig,
        model: refModel.current,
        automaticLayout: true,
        folding: true,
      });

      monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
      refMonacoEditor.current.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
        if (refMonacoEditor.current) {
          clearTimeout(refTimeout.current);

          const currentPosition = refMonacoEditor.current?.getPosition();

          const code = refMonacoEditor.current.getValue() || '';
          refSnippet.current = await formatCode(code);

          updateMonacoCursorPositon(currentPosition!);

          await fetchType(refSnippet.current);

          refTimeout.current = setTimeout(() => {
            void triggerValidation();
          }, 400);
        }
      });

      refMonacoEditor.current.onDidChangeModelContent(() => {
        clearTimeout(refTimeout.current);
        refSnippet.current = refMonacoEditor.current?.getValue() || '';

        if (refSnippetIndex.current) {
          void storageSetItem(STORAGE_CACHE_NAME, `${STORAGE_PREFIX}-${refSnippetIndex.current}`, refSnippet.current);
        }

        busDispatch({
          type: '@@-monaco-editor-update-code',
          data: refSnippet.current,
        });

        busDispatch({
          type: '@@-monaco-editor-show-preview',
          data: refSnippet.current.includes('createRoot'),
        });

        refTimeout.current = setTimeout(() => {
          busDispatch({
            type: '@@-monaco-editor-types-progress',
            data: 0,
          });

          refTimeout.current = setTimeout(async () => {
            await fetchType(refSnippet.current);
            void triggerValidation();
          }, 40);
        }, 0);
      });
    }

    return () => {
      clearTimeout(refTimeout.current);
      refModel.current?.dispose();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEventBus<IEventBusMonacoEditorUpdateCursorPosition>('@@-monaco-editor-update-cursor-position', ({ data }) => {
    updateMonacoCursorPositon(data);
  });

  useEventBus<IEventBusMonacoEditorExecuteSnippet>('@@-monaco-editor-execute-snippet', () => {
    refMonacoEditor.current?.updateOptions({
      readOnly: true,
    });
    setIsReadOnly(true);
  });

  useEventBus<IEventBusIframeDestroy>('@@-iframe-destroy', () => {
    refMonacoEditor.current?.updateOptions({
      readOnly: false,
    });
    setIsReadOnly(false);
    refMonacoEditor.current?.focus();
  });

  return (
    <div
      className={cn(
        'relative flex-1',
        'transition-opacity duration-300',
        {
          ['opacity-50 pointer-events-none']: isReadOnly,
        },
      )}
    >
      <div ref={refMonacoEditorContainer} className="size-full" />
      <Progress classNames="absolute top-2 right-6 z-100" size={18} />
    </div>
  );
};

MonacoEditor.displayName = 'MonacoEditor';
