FROM python:3.11-slim

WORKDIR /app
COPY app.py /app/app.py
COPY index.html /app/index.html
COPY app.js /app/app.js
COPY styles.css /app/styles.css
COPY .htpasswd /app/.htpasswd
COPY favicon.ico /app/favicon.ico

RUN pip install --no-cache-dir fastapi uvicorn openai anyio pydantic passlib

EXPOSE 80
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "80"]
