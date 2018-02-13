FROM python:3

LABEL maintainer="Geometalab <geometalab@hsr.ch>"

RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

ENV DOCKERIZE_VERSION v0.6.0
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz

RUN pip install uwsgi psycopg2

COPY requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

EXPOSE 8080

COPY . /opt/cf_audit
WORKDIR /opt/cf_audit
ENTRYPOINT [ "dockerize", "-wait", "tcp://database:5432" ]
CMD [ "uwsgi", "--chdir", "/opt/cf_audit/", "--http", ":8080", "--wsgi-file", "app.wsgi" ]
