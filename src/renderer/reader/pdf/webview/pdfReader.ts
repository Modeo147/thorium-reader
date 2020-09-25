// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END

import { debounce } from "debounce";
import * as path from "path";
import * as pdfJs from "pdfjs-dist";
import { PDFDocumentProxy } from "pdfjs-dist/types/display/api";
import {
    _DIST_RELATIVE_URL, _PACKAGING, _RENDERER_PDF_WEBVIEW_BASE_URL,
} from "readium-desktop/preprocessor-directives";

import {
    convertCustomSchemeToHttpUrl, READIUM2_ELECTRON_HTTP_PROTOCOL,
} from "@r2-navigator-js/electron/common/sessions";
import { Link } from "@r2-shared-js/models/publication-link";

import { IEventBusPdfPlayer } from "../common/pdfReader.type";

// import * as pdfJs from "pdfjs-dist/webpack";

// webpack.config.renderer-reader.js
// pdfJs.GlobalWorkerOptions.workerSrc = "pdf.worker.js";
// pdfJs.GlobalWorkerOptions.workerSrc = "https://unpkg.com/pdfjs-dist@2.6.347/build/pdf.worker.min.js";
// pdfJs.GlobalWorkerOptions.workerPort = new Worker("https://unpkg.com/pdfjs-dist@2.6.347/build/pdf.worker.min.js");
// const workerUrl = "https://unpkg.com/pdfjs-dist@2.6.347/build/pdf.worker.min.js";

const dirname = (global as any).__dirname || (document.location.pathname + "/../");

let workerUrl = "index_pdf.worker.js";
if (_PACKAGING === "1") {
    workerUrl = "file://" + path.normalize(path.join(dirname, workerUrl));
} else {
    if (_RENDERER_PDF_WEBVIEW_BASE_URL === "file://") {
        // dist/prod mode (without WebPack HMR Hot Module Reload HTTP server)
        workerUrl = "file://" +
            path.normalize(path.join(dirname, _DIST_RELATIVE_URL, workerUrl));
    } else {
        // dev/debug mode (with WebPack HMR Hot Module Reload HTTP server)
        workerUrl = "file://" + path.normalize(path.join(process.cwd(), "dist", workerUrl));
    }
}
workerUrl = workerUrl.replace(/\\/g, "/");

pdfJs.GlobalWorkerOptions.workerPort = new Worker(window.URL.createObjectURL(
    new Blob([`importScripts('${workerUrl}');`], { type: "application/javascript" })));

// HTTP Content-Type is "text/plain" :(
// pdfJs.GlobalWorkerOptions.workerSrc =
// "https://raw.githubusercontent.com/mozilla/pdfjs-dist/v2.6.347/build/pdf.worker.min.js";

// import * as path from "path";
// let workerPath = "pdf.worker.js";
// // if (_PACKAGING === "1") {
// //     preloadPath = "file://" + path.normalize(path.join((global as any).__dirname, preloadPath));
// // } else {
// //     preloadPath = "index_pdf.js";

// //     if (_RENDERER_READER_BASE_URL === "file://") {
// //         // dist/prod mode (without WebPack HMR Hot Module Reload HTTP server)
// //         preloadPath = "file://" +
// //             path.normalize(path.join((global as any).__dirname, _NODE_MODULE_RELATIVE_URL, preloadPath));
// //     } else {
// //         // dev/debug mode (with WebPack HMR Hot Module Reload HTTP server)
// //         preloadPath = "file://" + path.normalize(path.join(process.cwd(), "node_modules", preloadPath));
// //     }
// // }
// workerPath = "file://" + path.normalize(path.join(process.cwd(), "dist", workerPath));
// workerPath = workerPath.replace(/\\/g, "/");
// pdfJs.GlobalWorkerOptions.workerSrc = workerPath;

enum PdfDisplayMode {
    fitPageWidth = "fitPageWidth",
    fitWholePage = "fitWholePage",
    originalDimensions = "originalDimensions",
}
let _DisplayMode = PdfDisplayMode.fitPageWidth;

type TUnPromise<T extends any> =
    T extends Promise<infer R> ? R : any;
type TReturnPromise<T extends (...args: any) => any> =
    T extends (...args: any) => Promise<infer R> ? R : any;
type TUnArray<T extends any> =
    T extends Array<infer R> ? R : any;
type TGetDocument = ReturnType<typeof pdfJs.getDocument>;
type TPdfDocumentProxy = TUnPromise<TGetDocument["promise"]>;
type TOutlineRaw = TReturnPromise<TPdfDocumentProxy["getOutline"]>;
type TOutlineUnArray = TUnArray<TOutlineRaw>;

interface TdestForPageIndex { num: number; gen: number; }
type TdestObj = { name?: string} | TdestForPageIndex | null;

interface IOutline extends Partial<TOutlineUnArray> {
    dest?: string | TdestObj[];
    items?: IOutline[];
}

function destForPageIndexParse(destRaw: any | any[]): TdestForPageIndex | undefined {

    const destArray = Array.isArray(destRaw) ? destRaw : [destRaw];

    const destForPageIndex = destArray.reduce<TdestForPageIndex | undefined>(
        (pv, cv: TdestForPageIndex) => (typeof cv?.gen === "number" && typeof cv?.num === "number") ? cv : pv,
        undefined,
    );

    return destForPageIndex;
}

async function tocOutlineItemToLink(outline: IOutline, pdf: PDFDocumentProxy): Promise<Link> {

    const link = new Link();

    if (outline.dest) {

        const destRaw = outline.dest;
        let destForPageIndex: TdestForPageIndex | undefined;

        if (typeof destRaw === "string") {
            const destArray = await pdf.getDestination(destRaw);

            destForPageIndex = destForPageIndexParse(destArray);

        } else if (typeof destRaw === "object") {
            destForPageIndex = destForPageIndexParse(destRaw);
        }

        if (destForPageIndex) {
            const page = await pdf.getPageIndex(destForPageIndex);
            link.Href = page.toString();
        }

    }

    link.Title = typeof outline.title === "string" ? outline.title : "";

    if (Array.isArray(outline.items)) {

        const itemsPromise = outline.items.map(async (item) => tocOutlineItemToLink(item, pdf));
        link.Children = await Promise.all(itemsPromise);
    }

    return link;
}

type TToc = Link[];

export async function pdfReaderMountingPoint(
    rootElement: HTMLElement,
    pdfPath: string,
    bus: IEventBusPdfPlayer,
): Promise<TToc> {

    const canvas = document.createElement("canvas");
    rootElement.appendChild(canvas);

    canvas.width = rootElement.clientWidth;
    canvas.height = rootElement.clientHeight;
    canvas.setAttribute("style", "display: block; position: absolute; left: 0; top: 0;");

    console.log("BEFORE pdfJs.getDocument", pdfPath);
    if (pdfPath.startsWith(READIUM2_ELECTRON_HTTP_PROTOCOL)) {
        pdfPath = convertCustomSchemeToHttpUrl(pdfPath);
    }
    console.log("BEFORE pdfJs.getDocument ADJUSTED", pdfPath);
    const pdf = await pdfJs.getDocument(pdfPath).promise;
    console.log("AFTER pdfJs.getDocument", pdfPath);

    const outline: IOutline[] = await pdf.getOutline();
    let toc: TToc = [];

    try {
        if (Array.isArray(outline)) {
            const tocPromise = outline.map((item) => tocOutlineItemToLink(item, pdf));
            toc = await Promise.all(tocPromise);
        }
    } catch (e) {

        console.error("Error to convert outline to toc link");
        console.error(e);

        toc = [];
    }

    console.log("outline", outline);
    // console.log(await pdf.getDestination("p14"));
    // console.log(await pdf.getPageIndex((await pdf.getDestination("p14"))[0] as TdestForPageIndex));
    console.log("toc", toc);

    let _lastPageNumber = -1;

    const displayPageNumber = async (pageNumber: number) => {
        const pdfPage = await pdf.getPage(pageNumber);

        // PDF is 72dpi
        // CSS is 96dpi
        const SCALE = 1;
        const CSS_UNITS = 1; // 96 / 72;

        const viewportNoScale = pdfPage.getViewport({ scale: SCALE });

        const scaleW = rootElement.clientWidth / (viewportNoScale.width * CSS_UNITS);
        const scaleH = rootElement.clientHeight / (viewportNoScale.height * CSS_UNITS);
        const scale = _DisplayMode === PdfDisplayMode.fitPageWidth ? scaleW :
            (_DisplayMode === PdfDisplayMode.fitWholePage ? Math.min(scaleW, scaleH) :
            SCALE * 6); // PdfDisplayMode.originalDimensions
        console.log("PDF viewport scales", scaleW, scaleH, scale);

        const viewport = pdfPage.getViewport({ scale });

        const canvas2d = canvas.getContext("2d");
        canvas.width = viewport.width * CSS_UNITS;
        canvas.height = viewport.height * CSS_UNITS;
        canvas.style.left = _DisplayMode === PdfDisplayMode.fitPageWidth ? `0px` :
            (_DisplayMode === PdfDisplayMode.fitWholePage ? `${(rootElement.clientWidth - (viewport.width * CSS_UNITS)) / 2}px` :
            `0px`); // _DisplayMode === PdfDisplayMode.originalDimensions

        if (_DisplayMode === PdfDisplayMode.fitPageWidth) {
            canvas.ownerDocument.body.style.overflow = "hidden";
            canvas.ownerDocument.body.style.overflowX = "hidden";
            canvas.ownerDocument.body.style.overflowY = "auto";
        } else if (_DisplayMode === PdfDisplayMode.fitWholePage) {
            canvas.ownerDocument.body.style.overflow = "hidden";
            canvas.ownerDocument.body.style.overflowX = "hidden";
            canvas.ownerDocument.body.style.overflowY = "hidden";
        } else { // _DisplayMode === PdfDisplayMode.originalDimensions
            canvas.ownerDocument.body.style.overflow = "auto";
            canvas.ownerDocument.body.style.overflowX = "auto";
            canvas.ownerDocument.body.style.overflowY = "auto";
        }

        await pdfPage.render({
            canvasContext: canvas2d,
            viewport,
        }).promise;

        bus.dispatch("page", pageNumber);
    };

    const debouncedResize = debounce(async () => {
        console.log("resize DEBOUNCED", rootElement.clientWidth, rootElement.clientHeight);
        if (_lastPageNumber >= 0) {
            await displayPageNumber(_lastPageNumber);
        }
    }, 500);

    window.addEventListener("resize", async () => {
        console.log("resize", rootElement.clientWidth, rootElement.clientHeight);
        await debouncedResize();
    });

    canvas.addEventListener("dblclick", async () => {
        if (_DisplayMode === PdfDisplayMode.fitPageWidth) {
            _DisplayMode = PdfDisplayMode.fitWholePage;
        } else if (_DisplayMode === PdfDisplayMode.fitWholePage) {
            _DisplayMode = PdfDisplayMode.originalDimensions;
        } else { // _DisplayMode === PdfDisplayMode.originalDimensions
            _DisplayMode = PdfDisplayMode.fitPageWidth;
        }
        if (_lastPageNumber >= 0) {
            await displayPageNumber(_lastPageNumber);
        }
    });

    bus.subscribe("page", async (pageNumber: number) => {
        _lastPageNumber = pageNumber;
        await displayPageNumber(pageNumber);
    });

    return toc;
}
