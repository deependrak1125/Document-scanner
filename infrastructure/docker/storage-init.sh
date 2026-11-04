#!/bin/sh
set -eu
awslocal s3api create-bucket --bucket folio
awslocal s3api put-bucket-encryption --bucket folio --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
