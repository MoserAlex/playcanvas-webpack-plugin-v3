const _ = require('lodash')
const https = require('node:https')
const FormData = require('form-data')

const pluginName = "PlayCanvasWebpackPlugin"

class PlayCanvasWebpackPlugin {
    constructor(options) {
        this.options = _.extend({
            files: {}
        }, options)
    }

    // Override
    apply(compiler) {
        let options = this.options
        compiler.hooks.emit.tap(pluginName, (compilation, callback) => {
            try {
                if (options.skipUpload) {
                    console.log("Skipping Upload")
                    if (callback) callback()
                    return
                }

                Object.keys(compilation.assets).forEach((key) => {
                    let asset = compilation.assets[key]
                    if (!asset || !asset._children) {
                        console.log(`asset or asset._children null ${asset}`)
                        return
                    }

                    let filename = options.files[key]
                    if (filename) {
                        if (!options.project) {
                            throw new Error(`No project, aborting ${filename.path}`)
                        }

                        if (!filename.assetId) {
                            throw new Error(`No assetId aborting ${filename.path}`)
                        }

                        if (!options.bearer) {
                            throw new Error("No bearer token, aborting")
                        }

                        console.log(`Uploading ${filename.path} to PlayCanvas`)
                        let content = asset._children.map(c => c._value ? c._value : c).join('\n')

                        // Create the payload of the request
                        const form = new FormData()
                        form.append("branchId", `${options.branchId}`)
                        form.append("file", content, {
                            filename: filename.path,
                            contentType: "text/javascript"
                        })

                        // Create the request to update an existing script asset
                        let updateRequest = https.request(`https://playcanvas.com/api/assets/${filename.assetId}`, {
                            method: 'PUT',
                            headers: {
                                ...form.getHeaders(),
                                "Authorization": `Bearer ${options.bearer}`
                            }
                        })

                        // Add the form data and submit the request
                        form.pipe(updateRequest)

                        updateRequest.on("response", (updateResponse) => {
                            updateResponse.resume()

                            // If the file is found, it will be replaced
                            if (updateResponse.statusCode === 200) {
                                console.log("\nPlayCanvas Webpack Plugin")
                                console.log(`Upload complete for file (update) ${filename.path}`)
                                compilation.warnings.push(`Upload complete for file (update) ${filename.path}`)
                                if (callback) callback()
                            }

                            // If the file isn't found, create a new one
                            if (updateResponse.statusCode === 404) {
                                updateResponse.on("end", () => {
                                    // Create the payload of the request
                                    const form = new FormData()
                                    form.append("name", `${filename.path}`)
                                    form.append("project", `${options.project}`)
                                    form.append("branchId", `${options.branchId}`)
                                    form.append("preload", "true")
                                    form.append("file", content, {
                                        filename: filename.path,
                                        contentType: "text/javascript"
                                    })

                                    // Create the request to create a new script asset
                                    let createRequest = https.request(`https://playcanvas.com/api/assets`, {
                                        method: 'POST',
                                        headers: {
                                            ...form.getHeaders(),
                                            "Authorization": `Bearer ${options.bearer}`
                                        }
                                    })

                                    // Add the form data and submit the request
                                    form.pipe(createRequest)

                                    createRequest.on("response", (createResponse) => {
                                        let rawData = ""
                                        createResponse.on("data", (chunk) => { rawData += chunk })
                                        createResponse.on("end", () => {
                                            const data = JSON.parse(rawData)
                                            console.log("\nPlayCanvas Webpack Plugin")
                                            console.log(`Upload complete for file (create) ${filename.path}`)
                                            const warning = `New main.build.js has been created. Update config assetId to ${data.id}`
                                            console.warn(warning)
                                            compilation.warnings.push(warning)
                                            if (callback) callback()
                                        })
                                    })

                                    createRequest.on("error", (e) => {
                                        console.error(e)
                                        compilation.errors.push(e)
                                        if (callback) callback()
                                    })
                                })
                            }
                        })

                        updateRequest.on("error", (e) => {
                            console.error(e)
                            compilation.errors.push(e)
                            if (callback) callback()
                        })
                    }
                })
            } catch (e) {
                console.error(e)
                compilation.errors.push(e)
                if (callback) callback()
            }
        })
    }
}

module.exports = PlayCanvasWebpackPlugin
