// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import * as commonmark from "commonmark";
import { readFile } from "fs";
import * as path from "path";
import * as React from "react";
import { connect } from "react-redux";
import { DialogTypeName } from "readium-desktop/common/models/dialog";
import { dialogActions } from "readium-desktop/common/redux/actions";
import { _PACKAGING } from "readium-desktop/preprocessor-directives";
import {
    TranslatorProps, withTranslator,
} from "readium-desktop/renderer/common/components/hoc/translator";
import { ILibraryRootState } from "readium-desktop/renderer/library/redux/states";
import { TDispatch } from "readium-desktop/typings/redux";
import { promisify } from "util";

import Dialog from "../../../common/components/dialog/Dialog";

// tslint:disable-next-line: no-empty-interface
interface IBaseProps extends TranslatorProps {
}
// IProps may typically extend:
// RouteComponentProps
// ReturnType<typeof mapStateToProps>
// ReturnType<typeof mapDispatchToProps>
// tslint:disable-next-line: no-empty-interface
interface IProps extends IBaseProps, ReturnType<typeof mapDispatchToProps>, ReturnType<typeof mapStateToProps> {
}

export class Information extends React.Component<IProps, undefined> {
    private parsedMarkdown: string;

    constructor(props: IProps) {
        super(props);
    }

    public async componentDidMount() {
        const { locale } = this.props;
        const infoFolderRelativePath = "assets/md/information";

        let folderPath: string = path.join((global as any).__dirname, infoFolderRelativePath);
        try {
            if (_PACKAGING === "0") {
                folderPath = path.join(process.cwd(), "dist", infoFolderRelativePath);
            }
            const fileContent = await promisify(readFile)(path.join(folderPath,
                `${locale.toLowerCase()}.md`), {encoding: "utf8"});
            this.parsedMarkdown = (new commonmark.HtmlRenderer()).render((new commonmark.Parser()).parse(fileContent));
        } catch (__) {
            this.parsedMarkdown = "<h1>There is no information for your language</h1>";
        }
        this.forceUpdate();
    }

    public render(): React.ReactElement<{}> {
        if (!this.props.open) {
            return (<></>);
        }

        const html = { __html: this.parsedMarkdown };
        return (
            <Dialog open={true} close={this.props.closeDialog}>
                <div dangerouslySetInnerHTML={html}></div>
            </Dialog>
        );
    }
}

const mapStateToProps = (state: ILibraryRootState, _props: IBaseProps) => {
    return {
        locale: state.i18n.locale,
        open: state.dialog.type === DialogTypeName.AboutThorium,
    };
};

const mapDispatchToProps = (dispatch: TDispatch, _props: IBaseProps) => {
    return {
        closeDialog: () => {
            dispatch(
                dialogActions.closeRequest.build(),
            );
        },
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(withTranslator(Information));
