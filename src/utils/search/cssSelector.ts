// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END=

import { uniqueCssSelector } from "@r2-navigator-js/electron/renderer/common/cssselector2";

const _getCssSelectorOptions = {
    className: (_str: string) => {
        return true;
    },
    idName: (_str: string) => {
        return true;
    },
    tagName: (_str: string) => {
        return true;
    },
};

export const getCssSelector_ = (doc: Document) => (element: Element): string => {
    try {
        return uniqueCssSelector(element, doc, _getCssSelectorOptions);
    } catch (err) {
        console.error("uniqueCssSelector:", err);
        return "";
    }
};
