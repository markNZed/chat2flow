# chatbot-server
this is the backend / server side of my chatbot app
1. written in Node JS run-time, Express framework
2. CI/CD is managed by AWS ElasticBeanstalk, EC2 behind the scene
3. source msg data is powered by OpenAi API's
4. feteched data is cached by node-cache

Note that we are running the server with HTTPS and WSS using a self-signed certificate.
You will need to visit the website e.g. https://localhost:5000 and authorize the certificate oterwise WSS will fail to connect. The image public/1x1.png is loaded by the client to test the connection to the server, it will
alert to an error if the certificate is invalid or 

to run this local: `npm run server` 
<br />
back-end was deployed here: http://chatbotbeanstalk-env.eba-xn42mmzq.us-west-2.elasticbeanstalk.com/ 
<br />
the front-end client side repo is here: https://github.com/YaokunLin/chatbot-react-client

