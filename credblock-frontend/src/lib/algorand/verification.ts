import algosdk from 'algosdk'
import { getAlgodConfigFromViteEnvironment } from '../../utils/network/getAlgoClientConfigs'

export async function getAssetInfo(assetId: bigint | string) {
  const config = getAlgodConfigFromViteEnvironment()
  const token = typeof config.token === 'string' ? config.token : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

  const client = new algosdk.Algodv2(token, config.server, config.port || '443')
  const assetIdNum = typeof assetId === 'string' ? parseInt(assetId) : Number(assetId)

  try {
    const assetInfo = await client.getAssetByID(assetIdNum).do()
    return assetInfo
  } catch (error: unknown) {
    if (error instanceof Error) {
      if ('status' in error || 'statusCode' in error) {
        const status = (error as { status?: number; statusCode?: number }).status ?? (error as { statusCode?: number }).statusCode
        if (status === 404) {
          return null
        }
      }
    }
    throw error
  }
}

export async function checkAssetOwnership(address: string, assetId: bigint | string): Promise<boolean> {
  try {
    const config = getAlgodConfigFromViteEnvironment()
    const token = typeof config.token === 'string' ? config.token : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

    const client = new algosdk.Algodv2(token, config.server, config.port || '443')
    const assetIdNum = typeof assetId === 'string' ? parseInt(assetId) : Number(assetId)

    const accountInfo = await client.accountInformation(address).do()
    const assets = accountInfo.assets as Array<{ 'asset-id'?: bigint; assetId?: bigint; amount?: bigint }> || []

    return assets.some((asset) => {
      const id = asset['asset-id'] ?? asset.assetId
      const amount = asset.amount
      return id && Number(id) === assetIdNum && amount && Number(amount) > 0
    })
  } catch {
    return false
  }
}

export async function checkAssetOptedIn(address: string, assetId: bigint | string): Promise<boolean> {
  try {
    const config = getAlgodConfigFromViteEnvironment()
    const token = typeof config.token === 'string' ? config.token : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

    const client = new algosdk.Algodv2(token, config.server, config.port || '443')
    const assetIdNum = typeof assetId === 'string' ? parseInt(assetId) : Number(assetId)

    const accountInfo = await client.accountInformation(address).do()
    const assets = accountInfo.assets as Array<{ 'asset-id'?: bigint; assetId?: bigint }> || []

    return assets.some((asset) => {
      const id = asset['asset-id'] ?? asset.assetId
      return id && Number(id) === assetIdNum
    })
  } catch {
    return false
  }
}

export async function getOwnedAssets(address: string): Promise<{ assetId: number; amount: number }[]> {
  try {
    const config = getAlgodConfigFromViteEnvironment()
    const token = typeof config.token === 'string' ? config.token : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

    const client = new algosdk.Algodv2(token, config.server, config.port || '443')
    const accountInfo = await client.accountInformation(address).do()
    const assets = accountInfo.assets as Array<{ 'asset-id'?: bigint; amount?: bigint }> || []

    return assets
      .filter((asset) => asset.amount && Number(asset.amount) > 0)
      .map((asset) => ({
        assetId: Number(asset['asset-id']),
        amount: Number(asset.amount),
      }))
  } catch {
    return []
  }
}