FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ffmpeg ca-certificates tini && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/yt && /opt/yt/bin/pip install --no-cache-dir "yt-dlp[default]"
ENV PATH="/opt/yt/bin:${PATH}" NODE_ENV=production PORT=8080 DATA_DIR=/data
WORKDIR /app
COPY package.json server.mjs ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.mjs"]


 

                                                                                                                                                               