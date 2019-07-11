import base64url from 'base64url'
import nacl from 'tweetnacl'
import { TypedArrays } from '@react-frontend-developer/buffers'

class SecureChannel {
  id
  key
  appName
  clientId
  socketIOChannel
  randomBytes

  constructor ({ id, key, appName, clientId, socketIOChannel, randomBytes }) {
    this.id = id
    this.key = key
    this.appName = appName
    this.clientId = clientId
    this.socketIOChannel = socketIOChannel
    this.randomBytes = randomBytes || nacl.randomBytes
  }

  subscribe = async (onMessage, onError) => {
    try {
      await this.socketIOChannel.start({
        channelId: this.id,
        onMessage: encryptedMessage => {
          const message = this.decrypt(encryptedMessage)
          onMessage(message)
        },
        onError
      })
    } catch (e) {
      onError && onError(e)
    }
  }

  emit = async message => {
    const nonceAndCypherText = await this.encrypt(message)
    await this.socketIOChannel.emit(nonceAndCypherText)
  }

  encrypt = async message => {
    const nonce = await this.randomBytes(nacl.secretbox.nonceLength)
    const cypherText = nacl.secretbox(
      TypedArrays.string2Uint8Array(message, 'utf8'),
      nonce,
      this.key
    )
    return Buffer.concat([Buffer.from(nonce), Buffer.from(cypherText)])
  }

  decrypt = data => {
    const nonceAndCypherText = new Uint8Array(data)
    const nonce = nonceAndCypherText.slice(0, nacl.secretbox.nonceLength)
    const cypherText = nonceAndCypherText.slice(nacl.secretbox.nonceLength)
    const plainText = nacl.secretbox.open(cypherText, nonce, this.key)
    return TypedArrays.uint8Array2string(plainText, 'utf8')
  }

  createConnectUrl (baseUrl) {
    const encodedKey = base64url.encode(this.key)
    const encodedAppName = base64url.encode(this.appName)
    return `${baseUrl}/telepath/connect#I=${
      this.id
    }&E=${encodedKey}&A=${encodedAppName}`
  }
}

export { SecureChannel }
