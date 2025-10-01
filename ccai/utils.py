def get_common_prefix(a, b):
    limit = min(len(a), len(b))
    i = 0
    while i < limit and a[i] == b[i]:
        i += 1
    return a[:i]

def get_common_suffix(a, b):
    limit = min(len(a), len(b))
    j = 0
    while j < limit and a[-1 - j] == b[-1 - j]:
        j += 1
    return a[len(a) - j:] if j > 0 else ''
