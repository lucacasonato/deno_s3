test: export AWS_REGION=us-east-1
test: export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
test: export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
test: export S3_ENDPOINT_URL=http://localhost:9000

test:
	docker-compose up -d && sleep 1

	aws --endpoint-url=${S3_ENDPOINT_URL} s3 rm --recursive s3://test || true
	aws --endpoint-url=${S3_ENDPOINT_URL} s3 rb s3://test || true
	aws --endpoint-url=${S3_ENDPOINT_URL} s3 mb s3://test

	aws --endpoint-url=${S3_ENDPOINT_URL} s3api delete-objects \
		--bucket versioning-test \
		--delete "$$(aws --endpoint-url=${S3_ENDPOINT_URL} s3api list-object-versions \
						 --bucket versioning-test \
						 --output=json \
						 --query='{Objects: *[].{Key:Key,VersionId:VersionId}}' | cat)" | cat || true
	aws --endpoint-url=${S3_ENDPOINT_URL} s3 rb s3://versioning-test || true
	aws --endpoint-url=${S3_ENDPOINT_URL} s3 mb s3://versioning-test

	aws --endpoint-url=${S3_ENDPOINT_URL} s3 rm --recursive s3://test.bucket || true
	aws --endpoint-url=${S3_ENDPOINT_URL} s3 rb s3://test.bucket || true

	deno test -A ${DENO_ARGS}

cleanup:
	docker-compose down