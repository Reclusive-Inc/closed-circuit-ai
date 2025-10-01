import asyncio
from ccai.args import parse_args, Args
from ccai.server import Server

async def async_main(args: Args | None = None):
    args = args or parse_args()
    server = Server()
    await server.serve(args)

def main():
    asyncio.run(async_main())

if __name__ == '__main__':
    main()
