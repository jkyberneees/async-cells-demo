const {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} = require('@aws-sdk/client-sqs')
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import ConsistentHash from './consistent-hash'

// Create ConsistentHash object and add cells.
const consistentHash = new ConsistentHash()
consistentHash.add('cell1')
consistentHash.add('cell2')

// Configure AWS region, queue URL, and topic ARN via environment variables or fallback values.
const region = process.env.AWS_REGION || 'us-east-1'
const originQueueUrl =
  process.env.ORIGIN_QUEUE_URL ||
  'http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/origin'
const enhancedTopicArn =
  process.env.ORIGIN_ENHANCED_TOPIC_ARN ||
  'arn:aws:sns:us-east-1:000000000000:origin_enhanced'
const awsEndpoint = process.env.AWS_ENDPOINT || 'http://localhost:4566'

// Initialize SQS and SNS clients with LocalStack endpoint.
const sqsClient = new SQSClient({
  region,
  endpoint: awsEndpoint,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
})
const snsClient = new SNSClient({
  region,
  endpoint: awsEndpoint,
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
})

/**
 * Processes an individual SQS message:
 * - Parses the message body.
 * - Extracts the RIDER_ID from the parsed payload.
 * - Computes the CELL_ID using the consistent hash.
 * - Forwards the message to the enhanced SNS topic with the CELL_ID attribute added.
 * @param {Object} message - The SQS message object.
 */
async function processMessage(message) {
  let riderId, messageAttributes, messageBody
  try {
    const bodyPayload = JSON.parse(message.Body)
    if (
      !bodyPayload.MessageAttributes ||
      !bodyPayload.MessageAttributes.RIDER_ID ||
      !bodyPayload.MessageAttributes.RIDER_ID.Value
    ) {
      console.error('Message missing RIDER_ID attribute:', message)
      return
    }

    messageBody = bodyPayload.Message
    messageAttributes = bodyPayload.MessageAttributes
    riderId = messageAttributes.RIDER_ID.Value
  } catch (err) {
    console.error('Error parsing message body:', err, message)
    return
  }

  // calculating target CELL_ID
  const cellId = consistentHash.get(riderId)

  // building forwarding params
  const publishParams = {
    TopicArn: enhancedTopicArn,
    Message: messageBody,
    MessageAttributes: {
      CELL_ID: {
        DataType: 'String',
        StringValue: cellId,
      },
    },
  }

  try {
    const publishData = await snsClient.send(new PublishCommand(publishParams))
    console.log(
      `Forwarded message: RIDER_ID ${riderId}, CELL_ID ${cellId}, MessageId ${publishData.MessageId}`,
    )
  } catch (err) {
    console.error(`Error forwarding message for RIDER_ID ${riderId}:`, err)
  }
}

/**
 * Deletes a processed message from the SQS queue.
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
 * and deletes each message after processing.
 */
async function pollMessages() {
  console.log('Starting to poll messages from:', originQueueUrl)
  while (true) {
    try {
      const receiveParams = {
        QueueUrl: originQueueUrl,
        WaitTimeSeconds: 20,
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
 * Sets up a graceful shutdown on SIGINT.
 */
function setupSignalHandlers() {
  process.on('SIGINT', () => {
    console.log('Shutting down consumer...')
    process.exit(0)
  })
}

setupSignalHandlers()
pollMessages()
