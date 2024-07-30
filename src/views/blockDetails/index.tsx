import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useParams } from 'react-router-dom';

import { CopyToClipboard } from '@components/copyToClipboard';
import { Icon } from '@components/icon';
import { ToggleButton } from '@components/toggleButton';
import { PDLink } from '@components/ui/PDLink';
import { useStoreChain } from '@stores';
import { getValidatorId } from '@utils/rpc/getValidatorId';

import styles from './styles.module.css';

import type { IBlock } from '@custom-types/block';

interface IRuntimeVersion {
  specVersion: number;
  transactionVersion: number;
}

interface IBlockData {
  number: number;
  blockHash: string;
  extrinsicsRoot: string;
  parentHash: string;
  stateRoot: string;
  specVersion: number;
  validatorId: string | null;
}

const BlockDetails = () => {
  const { blockId } = useParams();
  const [isChecked, setIsChecked] = useState<boolean>(false);
  const [blockData, setBlockData] = useState<IBlockData | undefined>();

  const [timeStamp] = useState<string>('2024-06-26 14:21:42');

  const rawClient = useStoreChain.use.rawClient?.();
  const latestFinalizedBlock = useStoreChain.use.latestFinalizedBlock?.();

  const handleSetCheck = useCallback((): void => {
    setIsChecked(state => !state);
  }, []);

  const init = useCallback(async (blockId: number) => {
    if (!rawClient || !blockId) {
      return;
    }
    try {
      // Fetch the block hash using the block number
      const blockHash: string = await rawClient.request('chain_getBlockHash', [blockId]);

      // Fetch the latest block details using the block hash
      const latestBlock: { block: IBlock } = await rawClient.request('chain_getBlock', [blockHash]);

      // Fetch the runtime version
      const runTimeVersion: IRuntimeVersion = await rawClient.request('state_getRuntimeVersion', []);

      // Get the validator ID
      const validatorId: string | null = await getValidatorId(latestBlock.block);

      // Set the block data
      setBlockData({
        number: blockId,
        blockHash,
        extrinsicsRoot: latestBlock.block.header.extrinsicsRoot,
        parentHash: latestBlock.block.header.parentHash,
        stateRoot: latestBlock.block.header.stateRoot,
        specVersion: runTimeVersion.specVersion,
        validatorId,
      });

    } catch (error) {
      console.error('Error fetching block data:', error);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (rawClient && blockId) {
      void init(Number(blockId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawClient, blockId]);

  if (!blockData) {
    return <>loading</>;
  }

  return (
    <>
      <div className="mb-12  flex items-center  justify-between">
        <div className="flex items-center">
          <PDLink to="/explorer" className="mr-8 bg-dev-purple-700 p-2 dark:bg-white">
            <Icon
              name="icon-arrowLeft"
              className=" text-dev-white-200 dark:text-dev-purple-700"
            />
          </PDLink>
          <h4 className="mr-2 text-h4-light">Block</h4>
          <h4 className="text-h4-bold">{blockId}</h4>
        </div>

        <div className="flex gap-6">
          <PDLink
            to={`https://polkadot.subscan.io/block/${''}`}
            className="flex items-center gap-1"
          >
            <p className="font-geist text-body2-bold">Polkadot Statescan</p>
            <Icon name="icon-openLink" size={[16]} />
          </PDLink>
          <PDLink
            to={`https://polkadot.statescan.io/#/blocks/${''}`}
            className="flex items-center gap-1"
          >
            <p className="font-geist text-body2-bold">Polkadot Statescan</p>
            <Icon name="icon-openLink" size={[16]} />
          </PDLink>
        </div>
      </div>

      {/* Time stamp */}
      <div className={styles['pd-block-details']}>
        <p>Time stamp</p>

        <div>
          {isChecked ? new Date(timeStamp).toUTCString() : timeStamp}
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
          latestFinalizedBlock?.number !== blockData.number && (
            <div>
              <Icon
                name="icon-checked"
                className=" text-dev-white-200 dark:text-dev-purple-700"
                size={[16]}
              />
              <p>Finalized</p>
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
            text="0x7d6af371a0c713ec38b8a95dca3ba8b5a7f3eda2b3c81697b585a0facddcff77"
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
      </div >

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
