FROM ubuntu:focal


RUN apt update
RUN apt install curl git unzip -y
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt upgrade -y
RUN apt install -y nodejs
RUN curl -fsSL https://bun.sh/install | bash

# Add bun to path
ENV PATH="/root/.bun/bin:${PATH}"


WORKDIR /home/app

COPY main.sh main.sh
COPY script.ts script.ts
COPY package*.json .

RUN bun install

RUN chmod +x main.sh
RUN chmod +x script.ts

ENTRYPOINT  ["/home/app/main.sh"]