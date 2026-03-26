const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return Response.json({ message: "Hello from the API" });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`API running at http://localhost:${server.port}`);
