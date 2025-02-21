#!/usr/bin/env node
import {
  SNSClient,
  CreateTopicCommand,
  SubscribeCommand,
} from '@aws-sdk/client-sns'
import {
  SQSClient,
  CreateQueueCommand,
  GetQueueAttributesCommand,
  SetQueueAttributesCommand,
} from '@aws-sdk/client-sqs'

// Instantiate AWS SDK clients with LocalStack endpoint
const snsClient = new SNSClient({
  endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
})

const sqsClient = new SQSClient({
  endpoint: process.env.LOCALSTACK_ENDPOINT || 'http://localhost:4566',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
})

// Helper: Create an SNS topic and return its ARN
async function createSNSTopic(topicName) {
  try {
    const data = await snsClient.send(
      new CreateTopicCommand({ Name: topicName }),
    )
    console.log(`SNS topic '${topicName}' created with ARN: ${data.TopicArn}`)
    return data.TopicArn
  } catch (err) {
    console.error(`Error creating SNS topic '${topicName}':`, err)
    throw err
  }
}

// Helper: Create an SQS queue and return its URL and ARN
async function createSQSQueue(queueName) {
  try {
    const createQueueData = await sqsClient.send(
      new CreateQueueCommand({ QueueName: queueName }),
    )
    const queueUrl = createQueueData.QueueUrl
    // Retrieve the queue ARN using GetQueueAttributes
    const attrData = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['QueueArn'],
      }),
    )
    const queueArn = attrData.Attributes.QueueArn
    console.log(
      `SQS queue '${queueName}' created with URL: ${queueUrl} and ARN: ${queueArn}`,
    )
    return { queueUrl, queueArn }
  } catch (err) {
    console.error(`Error creating SQS queue '${queueName}':`, err)
    throw err
  }
}

// Helper: Subscribe an SQS queue to an SNS topic with optional filter policy
async function subscribeQueueToTopic(topicArn, queueArn, filterPolicy) {
  try {
    const params = {
      TopicArn: topicArn,
      Protocol: 'sqs',
      Endpoint: queueArn,
    }
    if (filterPolicy) {
      params.Attributes = {
        FilterPolicy: JSON.stringify(filterPolicy),
      }
    }
    const data = await snsClient.send(new SubscribeCommand(params))
    console.log(
      `Subscribed SQS queue (${queueArn}) to SNS topic (${topicArn}). Subscription ARN: ${data.SubscriptionArn}`,
    )
    return data.SubscriptionArn
  } catch (err) {
    console.error(
      `Error subscribing queue (${queueArn}) to topic (${topicArn}):`,
      err,
    )
    throw err
  }
}

// Helper: Set the SQS queue policy to allow SNS to send messages to the queue
async function setQueuePolicy(queueUrl, queueArn, topicArn) {
  try {
    const policy = {
      Version: '2012-10-17',
      Id: `${queueArn}/SQSDefaultPolicy`,
      Statement: [
        {
          Sid: 'Allow-SNS-SendMessage',
          Effect: 'Allow',
          Principal: { Service: 'sns.amazonaws.com' },
          Action: 'sqs:SendMessage',
          Resource: queueArn,
          Condition: {
            ArnEquals: {
              'aws:SourceArn': topicArn,
            },
          },
        },
      ],
    }
    await sqsClient.send(
      new SetQueueAttributesCommand({
        QueueUrl: queueUrl,
        Attributes: {
          Policy: JSON.stringify(policy),
        },
      }),
    )
    console.log(
      `Policy set on SQS queue (${queueArn}) to allow SNS topic (${topicArn})`,
    )
  } catch (err) {
    console.error(`Error setting policy on SQS queue (${queueArn}):`, err)
    throw err
  }
}

// Main initializer function
async function init() {
  try {
    // Setup for 'origin'
    const originTopicArn = await createSNSTopic('origin')
    const { queueUrl: originQueueUrl, queueArn: originQueueArn } =
      await createSQSQueue('origin')
    await subscribeQueueToTopic(originTopicArn, originQueueArn)
    await setQueuePolicy(originQueueUrl, originQueueArn, originTopicArn)

    // Setup for 'origin_enhanced'
    const originEnhancedTopicArn = await createSNSTopic('origin_enhanced')
    // Create SQS queues for cell1 and cell2
    const { queueUrl: cell1QueueUrl, queueArn: cell1QueueArn } =
      await createSQSQueue('cell1')
    const { queueUrl: cell2QueueUrl, queueArn: cell2QueueArn } =
      await createSQSQueue('cell2')

    // Subscribe each queue with message filtering on CELL_ID
    await subscribeQueueToTopic(originEnhancedTopicArn, cell1QueueArn, {
      CELL_ID: ['cell1'],
    })
    await subscribeQueueToTopic(originEnhancedTopicArn, cell2QueueArn, {
      CELL_ID: ['cell2'],
    })

    // Set policies for cell1 and cell2 queues
    await setQueuePolicy(cell1QueueUrl, cell1QueueArn, originEnhancedTopicArn)
    await setQueuePolicy(cell2QueueUrl, cell2QueueArn, originEnhancedTopicArn)

    console.log(
      'SNS and SQS resources have been successfully initialized via LocalStack.',
    )
  } catch (err) {
    console.error('Initialization failed:', err)
    process.exit(1)
  }
}

init()
