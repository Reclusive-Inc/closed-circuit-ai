import importlib.resources

root = importlib.resources.files('ccai')

resources = {
    'app': root.joinpath('app'),
    'app/index.html': root.joinpath('app', 'index.html'),
    'app/notebook.html': root.joinpath('app', 'notebook.html'),
    'app/favicon.ico': root.joinpath('app', 'favicon.ico'),
    'app/favicon.svg': root.joinpath('app', 'favicon.svg'),
    'apps': root.joinpath('apps'),
    'chat/__init__.py': root.joinpath('apps', 'chat', '__init__.py'),
    'chat/v1': root.joinpath('apps', 'chat'),
    'chat/v1/__init__.py': root.joinpath('apps', 'chat', 'v1', '__init__.py'),
    'chat/v1/chat.html': root.joinpath('apps', 'chat', 'v1', 'chat.html'),
    'chat/v1/chat.ipynb': root.joinpath('apps', 'chat', 'v1', 'chat.ipynb'),
    'chat/v1/chat.py': root.joinpath('apps', 'chat', 'v1', 'chat.py'),
    'chat/v1/static': root.joinpath('apps', 'chat', 'v1', 'static'),
}
