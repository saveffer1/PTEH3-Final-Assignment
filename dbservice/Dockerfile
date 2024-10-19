FROM postgres:16.3-alpine3.20

COPY store.sql /docker-entrypoint-initdb.d/

ENTRYPOINT ["docker-entrypoint.sh"]

CMD ["postgres"]
