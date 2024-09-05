import { format } from 'date-fns';
import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';

import { CopyToClipboard } from '@components/copyToClipboard';
import { Icon } from '@components/icon';
import { PageHeader } from '@components/pageHeader';
import { PDLink } from '@components/pdLink';
import { ToggleButton } from '@components/toggleButton';
import { useStoreChain } from '@stores';
import { formatNumber } from '@utils/helpers';

import styles from './styles.module.css';

interface IBlockData {
  number: number;
  blockHash: string;
  extrinsicsRoot: string;
  parentHash: string;
  stateRoot: string;
  specVersion: number;
  validatorId: string;
  timeStamp: string;
}

const BlockDetails = () => {
  const latestFinalizedBlock = useStoreChain.use.finalizedBlock?.();
  const { blockNumber } = useParams();

  const [isChecked, setIsChecked] = useState<boolean>(false);
  const [blockData, setBlockData] = useState<IBlockData | undefined>();
  const [isFinalized, setIsFinalized] = useState<boolean>(false);
  const blocksData = useStoreChain?.use?.blocksData?.();

  const handleSetCheck = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.currentTarget.parentNode as HTMLDivElement;
    const format = target.getAttribute('data-format');
    target.setAttribute('data-format', format === 'utc' ? 'local' : 'utc');

    setIsChecked(state => !state);
  }, []);

  useEffect(() => {
    if (blockNumber && blocksData.size > 0) {
      const block = blocksData.get(Number(blockNumber));
      if (!block) {
        return;
      }
      setBlockData({
        number: block.header.number,
        blockHash: block.header.hash,
        extrinsicsRoot: block.header.extrinsicRoot,
        parentHash: block.header.parentHash,
        stateRoot: block.header.stateRoot,
        specVersion: block.header.runtime?.spec_version || 0,
        validatorId: block.header.identity.toString(),
        timeStamp: format(new Date(block.header.timestamp), 'yyyy-MM-dd HH:mm:ss'),
      });
    }
  }, [blockNumber, blocksData]);

  useEffect(() => {
    if (latestFinalizedBlock && blockData) {
      const blockNumber = blockData.number || 0;
      const isBlockFinalized = blockNumber <= latestFinalizedBlock;

      setIsFinalized(isBlockFinalized);
    }
  }, [latestFinalizedBlock, blockData]);

  if (!blockData) {
    return <>loading</>;
  }

  return (
    <>
      <div className="mb-12 flex items-center justify-between">
        <PageHeader title="Block" blockNumber={formatNumber(blockData.number)} />
        <div className="flex gap-6">
          <PDLink
            to={`https://polkadot.subscan.io/block/${blockData.number}`}
            className={styles['pd-link-btn']}
            target="_blank"
            rel="noopener noreferrer"
          >
            Polkadot Subscan
            <Icon name="icon-openLink" size={[16]} />
          </PDLink>
          <PDLink
            to={`https://polkadot.statescan.io/#/blocks/${blockData.number}`}
            className={styles['pd-link-btn']}
            target="_blank"
            rel="noopener noreferrer"
          >
            Polkadot Statescan
            <Icon name="icon-openLink" size={[16]} />
          </PDLink>
        </div>
      </div>

      {/* Time stamp */}

      <div className={styles['pd-block-details']}>
        <p>Time stamp</p>

        <div>
          {isChecked ? new Date(blockData.timeStamp).toUTCString() : blockData.timeStamp}
          <ToggleButton
            isChecked={isChecked}
            handleSetCheck={handleSetCheck}
            classNames="ml-2"
          />
          UTC
        </div>
      </div>

      {/* Status */}
      <div className={styles['pd-block-details']}>
        <p>Status</p>

        {
          isFinalized
            ? (
              <div>
                <Icon
                  size={[16]}
                  name="icon-checked"
                  className="text-dev-green-600"
                />
                <p>Finalized</p>
              </div>
            )
            : (
              <div>
                <Icon
                  size={[16]}
                  name="icon-clock"
                  className="text-dev-yellow-700"
                />
                <p>Unfinalized</p>
              </div>
            )
        }
      </div>

      {/* Block Hash */}
      <div className={styles['pd-block-details']}>
        <p>Block Hash</p>

        <div className="gap-x-1">
          <p>{blockData.blockHash}</p>

          <CopyToClipboard
            text={blockData.blockHash}
            toastMessage="block hash"
          >
            {
              ({ ClipboardIcon }) => (
                <>
                  {ClipboardIcon}
                </>
              )
            }
          </CopyToClipboard>
        </div>
      </div>

      {/* Parent Hash */}
      <div className={styles['pd-block-details']}>
        <p>Parent Hash</p>

        <div>
          {blockData.parentHash}

          <CopyToClipboard
            text={blockData.parentHash}
            toastMessage="Parent Hash"
          >
            {
              ({ ClipboardIcon }) => (
                <>
                  {ClipboardIcon}
                </>
              )
            }
          </CopyToClipboard>
        </div>
      </div>

      {/* State Root */}
      <div className={styles['pd-block-details']}>
        <p>State Root</p>

        <div>
          {blockData.stateRoot}

          <CopyToClipboard
            text={blockData.stateRoot}
            toastMessage="State Root"
          >
            {
              ({ ClipboardIcon }) => (
                <>
                  {ClipboardIcon}
                </>
              )
            }
          </CopyToClipboard>
        </div>
      </div>

      {/* Extrinsic Root */}
      <div className={styles['pd-block-details']}>
        <p>Extrinsic Root</p>

        <div>
          {blockData.extrinsicsRoot}

          <CopyToClipboard
            text={blockData.extrinsicsRoot}
            toastMessage="Extrinsic Root"
          >
            {
              ({ ClipboardIcon }) => (
                <>
                  {ClipboardIcon}
                </>
              )
            }
          </CopyToClipboard>
        </div>
      </div>

      {
        blockData.validatorId && (
          <div className={styles['pd-block-details']}>
            <p>Validator</p>

            <div>
              <Icon name="logo-polkadotBlockDetails" />
              {blockData.validatorId}

              <CopyToClipboard
                text={blockData.validatorId}
                toastMessage="Validator"
              >
                {
                  ({ ClipboardIcon }) => (
                    <>
                      {ClipboardIcon}
                    </>
                  )
                }
              </CopyToClipboard>
            </div>
          </div>
        )
      }

      <div className={styles['pd-block-details']}>
        <p>Spec Version</p>

        <div>{blockData.specVersion}</div>
      </div>
    </>
  );
};

export default BlockDetails;
