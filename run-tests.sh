#!/bin/sh
# Set up S3
aws --endpoint-url=http://minio:9000 s3 rm --recursive s3://test || true
aws --endpoint-url=http://minio:9000 s3 rb s3://test || true
aws --endpoint-url=http://minio:9000 s3 mb s3://test

export AWS_REGION=us-east-1
export S3_ENDPOINT_URL=http://minio:9000

deno test --unstable -A