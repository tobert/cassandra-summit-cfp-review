#!/bin/sh

export CGO_ENABLED=0
go build -a -installsuffix cgo
