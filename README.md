# Introduction

This project demonstrates the integration of AWS SNS and SQS services using the AWS SDK v3 with LocalStack. It includes scripts for publishing and consuming messages, as well as enhancing messages using a consistent hashing mechanism. The sample code is designed to work with both live AWS environments and LocalStack for local development and testing.

# Requirements

- **Bun**: A fast JavaScript runtime. Install Bun from [https://bun.sh/](https://bun.sh/).
- **LocalStack**: A fully functional local AWS cloud stack. Install LocalStack as per guidance from the installation instructions in the LocalStack repository [https://github.com/localstack/localstack](https://github.com/localstack/localstack).

# Components

- **publisher.js**  
  Uses the `@aws-sdk/client-sns` module to publish messages to an SNS topic. Each message includes a `RIDER_ID` Message Attribute. This script supports integration with LocalStack by checking for specific environment variables.

- **consumer-consistent-hash-enricher.js**  
  An SQS consumer that polls messages from the origin SQS queue. It enhances each message by adding a `CELL_ID` attribute computed using a consistent hash function based on the incoming `RIDER_ID`. The enhanced message is then forwarded to an SNS topic. Processed messages are deleted from the queue after handling.

- **consumer-cell1.js**  
  Polls messages from a dedicated cell queue (`cell1`) and processes them separately. Designed for specific cell consumption, it includes detailed logging, error handling, and graceful shutdown capabilities.

- **consumer-cell2.js**  
  Similar to `consumer-cell1.js`, this script polls messages from another dedicated queue (`cell2`). It processes messages by parsing and logging the payload, then deletes messages after processing. It is tailored for workloads assigned to cell2.

- **consistent-hash.js**  
  Contains the implementation of the consistent hashing functionality used by the consumers to determine the `CELL_ID` based on the `RIDER_ID`. This module is leveraged by multiple consumer scripts to ensure consistent message routing.

# Queue URLs and Topic ARNs

The project uses the following default resource endpoints (overridable via environment variables):

- **Queue URLs:**

  - For the origin queue used by `consumer-consistent-hash-enricher.js`:  
    `http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/origin`

  - For the cell-specific queues:
    - `consumer-cell1.js` uses:  
      `http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/cell1`
    - `consumer-cell2.js` uses:  
      `http://sqs.us-east-1.localhost.localstack.cloud:4566/000000000000/cell2`

- **Topic ARNs:**
  - The SNS topic for publishing messages in `publisher.js`:  
    `arn:aws:sns:us-east-1:123456789012:origin`
  - The enhanced SNS topic used by consumers (`consumer-consistent-hash-enricher.js`):  
    `arn:aws:sns:us-east-1:000000000000:origin_enhanced`

# Conclusions

This project provides a comprehensive example of integrating AWS messaging services with local development tools. With LocalStack, developers can simulate AWS environments locally while using modern JavaScript runtimes like Bun to achieve high performance. The scripts demonstrate effective message publishing, consuming, and enhancement, making it a solid foundation for further development in distributed systems and microservices architectures.
