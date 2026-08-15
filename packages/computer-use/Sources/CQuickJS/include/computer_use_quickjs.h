#ifndef COMPUTER_USE_QUICKJS_H
#define COMPUTER_USE_QUICKJS_H

#include <stddef.h>

typedef struct CUQuickJS CUQuickJS;
typedef char *(*CUQuickJSInvoke)(void *opaque, const char *name, const char *arguments_json);

CUQuickJS *cu_quickjs_create(void *opaque, CUQuickJSInvoke invoke);
void cu_quickjs_destroy(CUQuickJS *engine);
char *cu_quickjs_evaluate(CUQuickJS *engine, const char *source);
void cu_quickjs_free_string(char *string);

#endif
