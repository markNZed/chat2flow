#!/bin/bash

cd /app/processor/rxjs
npm install
screen -d -m NODE_NAME=one npm start 2>&1 | tee one.log
sleep infinity
