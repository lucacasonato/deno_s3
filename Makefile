test: export AWS_REGION=us-east-1
test: export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
test: export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
test: export S3_ENDPOINT_URL=http://localhost:9000

test:
	docker-compose up -d

	aws --endpoint-url=http://localhost:9000 s3 rm --recursive s3://test || true
	aws --endpoint-url=http://localhost:9000 s3 rb s3://test || true
	aws --endpoint-url=http://localhost:9000 s3 rb s3://test-2 || true
	aws --endpoint-url=http://localhost:9000 s3 mb s3://test

	deno test -A ${DENO_ARGS}

cleanup:
	docker-compose down