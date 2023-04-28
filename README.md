# chat2flow

chat2flow is a Task centric collaborative web application framework leveraging AI that is under development.

## Overview

chat2flow supports activities combining software and AI models with human interaction. The originality of chat2flow is its Task centric approach. While the user will tend to think in workflows (a sequence of Tasks), chat2flow manages Tasks. Tasks can be chained into workflows, but the concept of a workflow is not central to chat2flow. The developer builds a Task, a Task may manage a set of Tasks, and a set of Tasks may be a workflow.

The developer of chat2flow designs Tasks that consist of:
* A textual specification (in Javascript syntax) of variables the Task may use
* An optional client side component that interacts with a user and updates the Task
* A server side function that updates the Task

For example, a chat application is a very simple Task (receive user input, return language model response) and the management of the conversation history (e.g., displaying or deleting previous messages) is another Task (or sequence of Tasks). Unlike a chat interface, chat2flow can provide any web-based interface depending on the client side implementation of a Task. Unlike a workflow application, chat2flow uses Tasks to dynamically build a user interface (UI) rather than providing a UI to build a workflow.

On the server side, chat2flow provides a kernel for evaluating Task functions, storing history, and initiating new Tasks. Tasks are asynchronous. Some Tasks may run on the server without user interaction. Tasks may use software or AI agents to decide on the next Task to run. The server uses Node Javascript with the Express framework.

On the client side, chat2flow provides Tasks with storage, server communication, and generic functionality (e.g., current user location). Tasks may use user input to decide on the next Task to run. The client runs in a web browser and builds on the React Javascript library with MUI user interface components. Server communication uses either websockets (e.g., for real-time interaction) or REST style HTTP API.

chat2flow provides a light, flexible infrastructure for human-computer interaction. The configuration of workflows and Tasks is not part of chat2flow (except for a simple demonstration). So the functionality of Tasks (both client interface and functionality) can be shared without sharing proprietary/private information such as the sequencing of Tasks and the content of prompts.

chat2flow should play nicely with:
* [LangChain](https://langchain.com/) (e.g., use LangChain features from within a Task function on the server)
* [LlamaIndex](https://pypi.org/project/gpt-index/) (from within a Task function on the server)

## Getting Started

To run chat2flow with docker, see [README.md](docker/README.md) in the docker directory.

To learn more about the server, see [README.md](server/README.md) in the server directory.

To learn more about the client, see [README.md](client/README.md) in the client directory.

## License

This project is licensed under the Mozilla Public License Version 2.0, see [LICENSE.txt](LICENSE.txt), and is open to contributions. An [ICLA](ICLA.txt) is provided for pull requests and managed automatically by https://cla-assistant.io. An important part of the ICLA allows the Project Owner to change the project license in the future. If the license is changed in the future, the source code prior to the change would still be available under the MPL 2.0, i.e., anyone could fork the MPL 2.0 project and continue using/developing chat2flow.

## Contributions

The initial client code was based on the React chatbot client [https://github.com/YaokunLin/chatbot-react-client](https://github.com/YaokunLin/chatbot-react-client), and the initial server code was based on the Node Express chatbot server [https://github.com/YaokunLin/chatbot-server](https://github.com/YaokunLin/chatbot-server). The generous developer of that code, Yaokun, replied by email on 2022-03-10 regarding the license, stating "I am glad you liked my repo, feel free to use my code. And I would appreciate it if you could cite my source repo when you release it to the public."

