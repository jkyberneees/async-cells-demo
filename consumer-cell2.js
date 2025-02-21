const {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} = require('@aws-sdk/client-sqs')

// Configure AWS region, queue URL, and endpoint via environment variables or fallback values.
const region = process.env.AWS_REGION || 'us-east-1'
const originQueueUrl =
  process.env.ORIGIN_QUEUE_URL ||
  'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/cell2'
const awsEndpoint = process.env.AWS_ENDPOINT || 'http://localhost:4566'

// Initialize SQS client with LocalStack endpoint.
const sqsClient = new SQSClient({
  region,
  endpoint: awsEndpoint,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
})

/**
 * Process an individual message.
 * Attempts to parse the message body as JSON and logs the payload.
 * @param {Object} message - The SQS message object.
 */
async function processMessage(message) {
  console.log('Processing incoming cell1 message...')
  try {
    const payload = JSON.parse(message.Body)
    console.log('Parsed payload:', payload)
  } catch (err) {
    console.error('Error parsing message body:', err)
  }
}

/**
 * Deletes a processed message from the queue.
 * @param {Object} message - The SQS message object.
 */
async function deleteMessage(message) {
  try {
    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: originQueueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }),
    )
    console.log('Deleted message with ReceiptHandle:', message.ReceiptHandle)
  } catch (err) {
    console.error('Error deleting message:', err)
  }
}

/**
 * Polls messages from the origin SQS queue, processes them,
 * and then deletes each message after processing.
 */
async function pollMessages() {
  console.log('Starting to poll messages from:', originQueueUrl)
  while (true) {
    try {
      const receiveParams = {
        QueueUrl: originQueueUrl,
        WaitTimeSeconds: 20, // Enable long polling
        MaxNumberOfMessages: 10,
        MessageAttributeNames: ['All'],
      }
      const { Messages } = await sqsClient.send(
        new ReceiveMessageCommand(receiveParams),
      )

      if (Messages && Messages.length > 0) {
        for (const message of Messages) {
          await processMessage(message)
          await deleteMessage(message)
        }
      } else {
        console.log('No messages received. Waiting for new messages...')
      }
    } catch (err) {
      console.error('Error receiving messages from SQS:', err)
    }
  }
}

/**
 * Set up graceful shutdown on SIGINT.
 */
function setupSignalHandlers() {
  process.on('SIGINT', () => {
    console.log('Shutting down consumer...')
    process.exit(0)
  })
}

setupSignalHandlers()
pollMessages()
