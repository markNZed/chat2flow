#!/bin/bash

cd /app/hub
npm install
screen -d -m NODE_NAME=zero PORT=3000 npm start 2>&1 | tee hub.log
sleep infinity
