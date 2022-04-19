"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFilesFromDirectories = exports.writeManifestToFile = exports.writeObjectsToFile = exports.getTempDirectory = void 0;
const fs = require("fs");
const path = require("path");
const core = require("@actions/core");
const os = require("os");
const timeUtils_1 = require("./timeUtils");
function getTempDirectory() {
    return process.env["runner.tempDirectory"] || os.tmpdir();
}
exports.getTempDirectory = getTempDirectory;
function writeObjectsToFile(inputObjects) {
    const newFilePaths = [];
    inputObjects.forEach((inputObject) => {
        var _a;
        try {
            const inputObjectString = JSON.stringify(inputObject);
            if ((_a = inputObject === null || inputObject === void 0 ? void 0 : inputObject.metadata) === null || _a === void 0 ? void 0 : _a.name) {
                const fileName = getManifestFileName(inputObject.kind, inputObject.metadata.name);
                fs.writeFileSync(path.join(fileName), inputObjectString);
                newFilePaths.push(fileName);
            }
            else {
                core.debug("Input object is not proper K8s resource object. Object: " +
                    inputObjectString);
            }
        }
        catch (ex) {
            core.debug(`Exception occurred while writing object to file ${inputObject}: ${ex}`);
        }
    });
    return newFilePaths;
}
exports.writeObjectsToFile = writeObjectsToFile;
function writeManifestToFile(inputObjectString, kind, name) {
    if (inputObjectString) {
        try {
            const fileName = getManifestFileName(kind, name);
            fs.writeFileSync(path.join(fileName), inputObjectString);
            return fileName;
        }
        catch (ex) {
            throw Error(`Exception occurred while writing object to file: ${inputObjectString}. Exception: ${ex}`);
        }
    }
}
exports.writeManifestToFile = writeManifestToFile;
function getManifestFileName(kind, name) {
    const filePath = `${kind}_${name}_ ${timeUtils_1.getCurrentTime().toString()}`;
    const tempDirectory = getTempDirectory();
    return path.join(tempDirectory, path.basename(filePath));
}
function getFilesFromDirectories(filePaths) {
    const fullPathSet = new Set();
    filePaths.forEach((fileName => {
        try {
            if (fs.lstatSync(fileName).isDirectory()) {
                recurisveManifestGetter(fileName).forEach((file) => { fullPathSet.add(file); });
            }
            else if (getFileExtension(fileName) === "yml" || getFileExtension(fileName) === "yaml") {
                fullPathSet.add(fileName);
            }
            else {
                core.debug(`Detected non-manifest file, ${fileName}, continuing... `);
            }
        }
        catch (ex) {
            throw Error(`Exception occurred while reading the file ${fileName}: ${ex}`);
        }
    }));
    return Array.from(fullPathSet);
}
exports.getFilesFromDirectories = getFilesFromDirectories;
function recurisveManifestGetter(dirName) {
    const toRet = [];
    fs.readdirSync(dirName).forEach((fileName) => {
        const fnwd = path.join(dirName, fileName);
        if (fs.lstatSync(fnwd).isDirectory()) {
            toRet.push(...recurisveManifestGetter(fnwd));
        }
        else if (getFileExtension(fileName) === "yml" || getFileExtension(fileName) === "yaml") {
            toRet.push(path.join(dirName, fileName));
        }
        else {
            core.debug(`Detected non-manifest file, ${fileName}, continuing... `);
        }
    });
    return toRet;
}
function getFileExtension(fileName) {
    return fileName.slice((fileName.lastIndexOf(".") - 1 >>> 0) + 2);
}
