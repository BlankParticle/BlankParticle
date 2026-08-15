#include "computer_use_quickjs.h"
#include "quickjs.h"

#include <stdlib.h>
#include <string.h>

struct CUQuickJS {
    JSRuntime *runtime;
    JSContext *context;
    void *opaque;
    CUQuickJSInvoke invoke;
};

static JSValue invoke_computer_use(
    JSContext *context,
    JSValueConst this_value,
    int argument_count,
    JSValueConst *arguments
) {
    (void)this_value;
    CUQuickJS *engine = JS_GetContextOpaque(context);
    if (argument_count != 2) {
        return JS_ThrowTypeError(context, "computer operation requires a name and arguments");
    }

    const char *name = JS_ToCString(context, arguments[0]);
    const char *arguments_json = JS_ToCString(context, arguments[1]);
    if (name == NULL || arguments_json == NULL) {
        JS_FreeCString(context, name);
        JS_FreeCString(context, arguments_json);
        return JS_EXCEPTION;
    }

    char *response = engine->invoke(engine->opaque, name, arguments_json);
    JS_FreeCString(context, name);
    JS_FreeCString(context, arguments_json);
    if (response == NULL) {
        return JS_ThrowInternalError(context, "computer operation returned no response");
    }
    JSValue result = JS_NewString(context, response);
    free(response);
    return result;
}

static int evaluate_bootstrap(CUQuickJS *engine) {
    static const char bootstrap[] =
        "globalThis.__computerLogs = [];"
        "globalThis.console = Object.freeze({"
        "log: (...values) => __computerLogs.push(values.map(value => "
        "typeof value === 'string' ? value : JSON.stringify(value)).join(' '))"
        "});"
        "const invoke = (name, arguments = {}) => {"
        "const response = JSON.parse(__computerInvoke(name, JSON.stringify(arguments)));"
        "if (!response.ok) throw new Error(response.error);"
        "return response.value;"
        "};"
        "globalThis.computer = Object.freeze({"
        "listApps: () => invoke('list_apps'),"
        "getAccessibilityTree: app => invoke('get_accessibility_tree', { app }),"
        "getAccessibilityNode: (app, element_index) => invoke('get_accessibility_node', { app, element_index }),"
        "click: arguments => invoke('click', arguments),"
        "drag: arguments => invoke('drag', arguments),"
        "pressKey: arguments => invoke('press_key', arguments),"
        "typeText: arguments => invoke('type_text', arguments),"
        "performSecondaryAction: arguments => invoke('perform_secondary_action', arguments),"
        "setValue: arguments => invoke('set_value', arguments),"
        "selectText: arguments => invoke('select_text', arguments),"
        "scroll: arguments => invoke('scroll', arguments)"
        "});";

    JSValue result = JS_Eval(
        engine->context,
        bootstrap,
        sizeof(bootstrap) - 1,
        "<computer-use-bootstrap>",
        JS_EVAL_TYPE_GLOBAL
    );
    int failed = JS_IsException(result);
    JS_FreeValue(engine->context, result);
    return failed ? -1 : 0;
}

CUQuickJS *cu_quickjs_create(void *opaque, CUQuickJSInvoke invoke) {
    CUQuickJS *engine = calloc(1, sizeof(*engine));
    if (engine == NULL) return NULL;
    engine->runtime = JS_NewRuntime();
    if (engine->runtime == NULL) goto fail;
    JS_SetMemoryLimit(engine->runtime, 128 * 1024 * 1024);
    JS_SetMaxStackSize(engine->runtime, 2 * 1024 * 1024);
    engine->context = JS_NewContext(engine->runtime);
    if (engine->context == NULL) goto fail;
    engine->opaque = opaque;
    engine->invoke = invoke;
    JS_SetContextOpaque(engine->context, engine);

    JSValue global = JS_GetGlobalObject(engine->context);
    JS_SetPropertyStr(
        engine->context,
        global,
        "__computerInvoke",
        JS_NewCFunction(engine->context, invoke_computer_use, "__computerInvoke", 2)
    );
    JS_FreeValue(engine->context, global);
    if (evaluate_bootstrap(engine) != 0) goto fail;
    return engine;

fail:
    cu_quickjs_destroy(engine);
    return NULL;
}

void cu_quickjs_destroy(CUQuickJS *engine) {
    if (engine == NULL) return;
    if (engine->context != NULL) JS_FreeContext(engine->context);
    if (engine->runtime != NULL) JS_FreeRuntime(engine->runtime);
    free(engine);
}

static char *copy_js_string(JSContext *context, JSValueConst value) {
    const char *string = JS_ToCString(context, value);
    if (string == NULL) return NULL;
    char *copy = strdup(string);
    JS_FreeCString(context, string);
    return copy;
}

char *cu_quickjs_evaluate(CUQuickJS *engine, const char *source) {
    if (engine == NULL || source == NULL) return NULL;
    JSContext *context = engine->context;
    JSValue reset = JS_Eval(
        context,
        "__computerLogs.length = 0",
        strlen("__computerLogs.length = 0"),
        "<repl>",
        JS_EVAL_TYPE_GLOBAL
    );
    JS_FreeValue(context, reset);

    JSValue result = JS_Eval(context, source, strlen(source), "<repl>", JS_EVAL_TYPE_GLOBAL);
    JSValue global = JS_GetGlobalObject(context);
    if (JS_IsException(result)) {
        JSValue exception = JS_GetException(context);
        JS_SetPropertyStr(context, global, "__computerError", JS_DupValue(context, exception));
        JSValue encoded = JS_Eval(
            context,
            "JSON.stringify({ok:false,error:String(__computerError.stack || __computerError),logs:__computerLogs})",
            strlen("JSON.stringify({ok:false,error:String(__computerError.stack || __computerError),logs:__computerLogs})"),
            "<repl-result>",
            JS_EVAL_TYPE_GLOBAL
        );
        char *response = copy_js_string(context, encoded);
        JS_FreeValue(context, encoded);
        JS_FreeValue(context, exception);
        JS_FreeValue(context, result);
        JS_FreeValue(context, global);
        return response;
    }

    JS_SetPropertyStr(context, global, "__computerResult", JS_DupValue(context, result));
    JSValue encoded = JS_Eval(
        context,
        "JSON.stringify({ok:true,result:__computerResult === undefined ? null : __computerResult,logs:__computerLogs})",
        strlen("JSON.stringify({ok:true,result:__computerResult === undefined ? null : __computerResult,logs:__computerLogs})"),
        "<repl-result>",
        JS_EVAL_TYPE_GLOBAL
    );
    char *response = copy_js_string(context, encoded);
    JS_FreeValue(context, encoded);
    JS_FreeValue(context, result);
    JS_FreeValue(context, global);
    return response;
}

void cu_quickjs_free_string(char *string) {
    free(string);
}
