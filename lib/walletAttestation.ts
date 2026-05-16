import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

export async function signLocalAttestation(
  connection: Connection,
  publicKey: PublicKey,
  signTransaction: (transaction: Transaction) => Promise<Transaction>,
  action: 'upload' | 'decrypt',
  subject: string
): Promise<void> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
  const message = `CipherGate ${action} approval: ${subject}`

  const transaction = new Transaction({
    feePayer: publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(
    new TransactionInstruction({
      keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: new TextEncoder().encode(message) as Buffer,
    })
  )

  await signTransaction(transaction)
}
