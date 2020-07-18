# deno_s3

Amazon S3 for Deno

## Examples

Coming soon...

## Contributing

To run tests you need to have a S3 bucket you can talk to. For local development you can use min.io to emulate an S3 bucket:

```
export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
docker-compose up -d
aws --endpoint-url "http://localhost:9000" s3 mb s3://test
deno test --allow-net --allow-env
```
