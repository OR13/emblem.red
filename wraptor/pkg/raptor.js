import * as wasm from "./raptor_bg.wasm";
import { __wbg_set_wasm } from "./raptor_bg.js";
__wbg_set_wasm(wasm);
export * from "./raptor_bg.js";
