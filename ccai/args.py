import argparse
from pydantic import BaseModel

class Args(BaseModel):
    workspace_path: str | None = None
    host: str | None = None
    port: int | None = None
    expose: bool | None = None
    ssl_keyfile: str | None = None
    ssl_certfile: str | None = None
    overwrite_workspace: bool | None = None
    dont_open_browser: bool | None = None
    dont_reset_cells: bool | None = None
    kernel_connection_file: str | None = None
    kernel_api_host: str | None = None
    kernel_api_port: int | None = None
    kernel_api_ssl_keyfile: str | None = None
    kernel_api_ssl_certfile: str | None = None

def parse_args() -> Args:
    parser = argparse.ArgumentParser(description='closed-circuit-ai', prog='ccai')
    parser.add_argument('workspace_path', nargs='?', metavar='PATH', type=str, help='specify the workspace directory - default is <user-data>/closed-circuit-ai/')
    parser.add_argument('--host', type=str, help='server listen address - default is localhost (aka same-device only)')
    parser.add_argument('--port', type=int, help='server listen port - default is 8000')
    parser.add_argument('--expose', action='store_true', help='forces \'--host 0.0.0.0\' (aka accept connections from other devices)')
    parser.add_argument('--ssl-keyfile', type=str, help='path to SSL private key')
    parser.add_argument('--ssl-certfile', type=str, help='path to SSL public certificate')
    parser.add_argument('--overwrite-workspace', action='store_true', help='overwrite existing workspace files during resource unpacking')
    parser.add_argument('--dont-open-browser', action='store_true', help='don\'t automatically open web browser during startup')
    parser.add_argument('--dont-reset-cells', action='store_true', help='don\'t automatically clear stale cell execution data (execution_count & outputs)')
    parser.add_argument('--kernel-connection-file', type=str, help='specify a kernel connection file (to connect to an already-running kernel)')
    parser.add_argument('--kernel-api-host', type=str, help='kernel server listen address - default is localhost')
    parser.add_argument('--kernel-api-port', type=int, help='kernel server listen port - default is 8100')
    parser.add_argument('--kernel-api-ssl-keyfile', type=str, help='path to SSL private key')
    parser.add_argument('--kernel-api-ssl-certfile', type=str, help='path to SSL public certificate')
    return Args(**vars(parser.parse_args()))
