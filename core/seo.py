class ApiNoIndexMiddleware:
    """Excluye respuestas de API del índice sin bloquear su rastreo ni su uso."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def send_with_noindex(message):
            if message["type"] == "http.response.start":
                headers = [
                    (key, value)
                    for key, value in message.get("headers", [])
                    if key.lower() != b"x-robots-tag"
                ]
                message = {
                    **message,
                    "headers": headers + [(b"x-robots-tag", b"noindex, nofollow")],
                }
            await send(message)

        await self.app(scope, receive, send_with_noindex)
