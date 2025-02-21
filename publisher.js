import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'

// Configure the AWS region and topic ARN either via environment variables or fallback values.
const topicArn =
  process.env.TOPIC_ARN || 'arn:aws:sns:us-east-1:000000000000:origin'
const region = process.env.AWS_REGION || 'us-east-1'

// Initialize the SNS client with LocalStack integration if enabled.
const snsClient = new SNSClient({
  region,
  endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
})

async function publishMessage(riderId, message) {
  const params = {
    TopicArn: topicArn,
    Message: message,
    MessageAttributes: {
      RIDER_ID: {
        DataType: 'String',
        StringValue: riderId,
      },
    },
  }

  try {
    const data = await snsClient.send(new PublishCommand(params))
    console.log(
      `Message published for ${riderId}: MessageId = ${data.MessageId}`,
    )
  } catch (err) {
    console.error(`Error publishing message for ${riderId}:`, err)
  }
}

async function main() {
  // Publish two messages with different RIDER_ID attributes.
  await Promise.all([
    publishMessage('rider:0001', 'Message for rider 0001'),
    publishMessage('rider:1000', 'Message for rider 1000'),
  ])
}

main()
