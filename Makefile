test: export AWS_REGION=us-east-1
test: export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
test: export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
test: export S3_ENDPOINT_URL=http://localhost:9000

test: setup-test-bucket setup-test-bucket-2
	deno test -A ${DENO_ARGS}

setup-test-bucket: docker
	aws --endpoint-url=${S3_ENDPOINT_URL} s3 rm --recursive s3://test || true
	aws --endpoint-url=${S3_ENDPOINT_URL} s3 rb s3://test || true
	aws --endpoint-url=${S3_ENDPOINT_URL} s3 mb s3://test

setup-test-bucket-2: docker
	aws --endpoint-url=${S3_ENDPOINT_URL} s3api delete-objects \
		--bucket test2 \
		--delete "$$(aws --endpoint-url=${S3_ENDPOINT_URL} s3api list-object-versions \
						 --bucket test2 \
						 --output=json \
						 --query='{Objects: *[].{Key:Key,VersionId:VersionId}}' | cat)" | cat || true
	aws --endpoint-url=${S3_ENDPOINT_URL} s3 rb s3://test2 || true

docker:
	docker-compose up -d && sleep 1

cleanup:
	docker-compose down
