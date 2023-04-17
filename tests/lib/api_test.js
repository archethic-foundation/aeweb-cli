
import * as fs from 'fs';
import chai, { expect } from 'chai';
import * as cli from '../../commands/cli.js';
import path from 'path';
import AEWeb from '../../lib/api.js';
import zlib from 'zlib'
import Archethic, { Utils, Crypto } from 'archethic'
import { AEWEB_VERSION, getFilePath, hashContent, HASH_FUNCTION } from '../../lib/utils.js';
import nock from 'nock'
import fetch from "cross-fetch";
import deepEqualInAnyOrder from 'deep-equal-in-any-order';
chai.use(deepEqualInAnyOrder);

const { originPrivateKey } = Utils

function createFolder(folderToCreate) {
    removeFolder(folderToCreate)
    fs.mkdirSync(folderToCreate)
}
function removeFolder(folderToRemove) {
    try {
        fs.rmSync(folderToRemove, { recursive: true });
    }
    catch (err) {
    }
}

const buildFolder = "dist/";
createFolder(buildFolder);

const api_test_folder = "dist/api_tests/";
createFolder(api_test_folder);

describe("Single File deployment", () => {
    const single_file_test_folder = path.join(api_test_folder, 'single_file_tests/')
    const endpoint = new URL("http://dummyTestnet:4000").origin;
    const archethic = new Archethic(endpoint);
    const aeweb = new AEWeb(archethic);
    const fileContent = `{ "data": "some data to upload" }`
    let fileTxContent = {};
    const baseSeed = "some seed";
    const seed = cli.getSeeds(baseSeed);
    let transactions = [];
    const slippage = 1.01;

    before(() => {
        nock.cleanAll()

        createFolder(single_file_test_folder);
    });

    after(() => {
        removeFolder(single_file_test_folder);
        nock.cleanAll()
    });

    it("should connect to endpoint", async () => {
        expect(aeweb.archethic).to.be.an.instanceOf(Archethic);
        expect(aeweb.archethic.endpoint.origin).to.equal(endpoint);

        const mockResponse = {
            "data": {
                "nearestEndpoints": [
                    {
                        "ip": "gib.raise.node",
                        "port": 40000
                    },
                    {
                        "ip": "sponser.node",
                        "port": 40000
                    },
                ]
            }
        };

        nock(endpoint).post('/api').reply(200, mockResponse);
        await aeweb.archethic.connect()

        expect(aeweb.archethic.nearestEndpoints).to.have.lengthOf(3);

        expect(aeweb.archethic.nearestEndpoints)
            .deep.equal(
                [
                    "http://gib.raise.node:40000",
                    "http://sponser.node:40000",
                    endpoint
                ]);

    })

    it("should load a File", () => {
        const filePath = path.join(single_file_test_folder, "single_File.json")

        fs.writeFileSync(filePath, fileContent, () => { });
        fs.writeFileSync(path.join(single_file_test_folder, "other_File.json"), "data", () => { });
        const files = cli.getFiles(filePath)

        expect(files).to.have.lengthOf(1);
        expect(files[0]["filePath"]).to.equal("single_File.json");
        expect(files[0]["data"]).deep.equal(Buffer.from(fileContent));

        files.forEach(({ filePath, data }) => aeweb.addFile(filePath, data))

        expect(aeweb.modifiedFiles).to.have.lengthOf(1);
        expect(aeweb.modifiedFiles[0]).to.equal("single_File.json");


        expect(aeweb.metaData).deep.equal({
            [getFilePath("single_File.json")]: {
                hash: hashContent(fileContent),
                size: Buffer.byteLength(fileContent),
                encoding: 'gzip',
                addresses: []
            }
        });
        fileTxContent = { ["single_File.json"]: zlib.gzipSync(fileContent).toString('base64url') }

        expect(aeweb.txsContent).deep.equal([{
            size: (zlib.gzipSync(fileContent).toString('base64url')).length + 7 + "single_File.json".length,
            "content": fileTxContent,
            refPath: ["single_File.json"]
        }
        ])


    });


    it("should be able create  txs", async () => {
        transactions = aeweb.getFilesTransactions()

        expect(transactions).to.have.lengthOf(1);
        expect(transactions[0].type).to.equal("hosting");

        expect(transactions[0].data).deep.equal({
            "code": new Uint8Array(0),
            "content": new TextEncoder().encode(JSON.stringify(fileTxContent))
            , "ownerships": [],
            "ledger": { "uco": { "transfers": [] }, "token": { "transfers": [] } },
            "recipients": []
        })


        // pass last index of file chain
        transactions[0] = transactions[0].build(seed.filesSeed, 0).originSign(originPrivateKey)

        expect(transactions[0].address).deep.equal(Crypto.deriveAddress(seed.filesSeed, 1));

        const refTx = await aeweb.getRefTransaction(transactions);
        refTx.build(seed.refSeed, 0).originSign(originPrivateKey)
        transactions.push(refTx)

        expect((new TextDecoder()).decode(refTx.data.content)).to.equal(JSON.stringify({
            "aewebVersion": AEWEB_VERSION,
            "hashFunction": HASH_FUNCTION,
            "metaData": {
                [`${getFilePath("single_File.json")}`]: {
                    hash: hashContent(fileContent),
                    size: Buffer.byteLength(fileContent),
                    encoding: 'gzip',
                    addresses: [`${Utils.maybeUint8ArrayToHex(transactions[0].address)}`]
                }
            }
        }))


        expect(transactions[1].address).deep.equal(Crypto.deriveAddress(seed.refSeed, 1));
    });

    it("should estimate tx fees",
        async () => {
            const chargeRefTx = 999;
            const chargeFileTx = 10000;
            const chargeTransferTx = 1000;

            nock(archethic.nearestEndpoints[0])
                .post('/api/transaction_fee', transactions[0].toJSON())
                .reply(
                    // file tx

                    function (uri, requestBody) {
                        if (
                            requestBody.address === Utils.maybeUint8ArrayToHex(transactions[0].address
                            )) {

                            return [200, { "fee": chargeFileTx, "rates": { "eur": 0.07906, "usd": 0.08349 } }];
                        }
                    });

            nock(archethic.nearestEndpoints[0])
                .post('/api/transaction_fee', transactions[1].toJSON())
                .reply(function (uri, requestBody) {
                    // ref tx
                    if (requestBody.address === Utils.maybeUint8ArrayToHex(transactions[1].address)) {
                        return [200, { "fee": chargeRefTx, "rates": { "eur": 0.07906, "usd": 0.08349 } }];
                    }
                });

            const { refTxFees, filesTxFees } = await cli.estimateTxsFees(archethic, transactions)

            expect(refTxFees)
                .to.deep.equal(
                    Math.trunc(slippage * chargeRefTx)
                );

            expect(filesTxFees)
                .to.deep.equal(
                    Math.trunc(slippage * chargeFileTx)
                );

            const transferTx = archethic.transaction.new()
                .setType('transfer')
                .addUCOTransfer(Crypto.deriveAddress(seed.refSeed, 0), refTxFees)
                .addUCOTransfer(Crypto.deriveAddress(seed.filesSeed, 0), filesTxFees)
                .build(baseSeed, 2).originSign(originPrivateKey)

            transactions.unshift(transferTx)



            nock(archethic.nearestEndpoints[0])
                .post('/api/transaction_fee', transactions[0].toJSON())
                .reply(function (uri, requestBody) {
                    // transfer tx
                    if (requestBody.address === Utils.maybeUint8ArrayToHex(transactions[0].address)) {
                        return [200, { "fee": chargeTransferTx, "rates": { "eur": 0.07906, "usd": 0.08349 } }];
                    }
                });
            const { fee, rates } = await archethic.transaction.getTransactionFee(transferTx)
            expect(fee).to.equal(chargeTransferTx)
            expect(rates).to.deep.equal({ "eur": 0.07906, "usd": 0.08349 })

            expect(nock.isDone()).to.be.true;
        });

    it("shoud  sendTransactions())/3 ", async () => {

        nock(archethic.nearestEndpoints[0])
            .post('/api/transaction', transactions[0].toJSON())
            .reply(200);

        nock(archethic.nearestEndpoints[0])
            .post('/api/transaction', transactions[1].toJSON())
            .reply(200);

        nock(archethic.nearestEndpoints[0])
            .post('/api/transaction', transactions[2].toJSON())
            .reply(200);


        const responses = await Promise.all(transactions.map((tx) => {
            return fetch(archethic.nearestEndpoints[0] + "/api/transaction", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: tx.toJSON(),
            })
        }));

        responses.forEach((response) => {
            expect(response.status).to.equal(200);
        })
        expect(nock.isDone()).to.be.true;
    });

});

describe("Folder deployment", () => {

    let testFolder,
        sslFolder,
        certificateData = 'mock cert',
        keyData = 'mock key', storageNoncePublicKey = "00017877BCF4122095926A49489009649603AB129822A19EF9D573B8FD714911ED7F",
        // certificateFilePath,
        // keyFilePath,
        archethic,
        aeweb,
        filesPath = [],
        filesContent = [],
        filesName = [],
        transactions = [],
        expectedTxsContent, slippage = 1.01,
        expectedMetaData;

    const baseSeed = "need certificate sponsor ship",
        seeds = cli.getSeeds(baseSeed),
        endpoint = new URL("http://Testnet:4000").origin,
        nearestEndpoints = { "data": { "nearestEndpoints": [] } };


    before(() => {
        nock.cleanAll()

        testFolder = path.join(buildFolder, 'deploy_tests/');
        createFolder(testFolder);

        // ssl-related action
        // sslFolder = path.join(buildFolder, 'ssl_tests/');
        // createFolder(sslFolder);
        // certificateFilePath = path.join(sslFolder, 'certificate.pem')
        // fs.writeFileSync(certificateFilePath, certificateData)
        // keyFilePath = path.join(sslFolder, 'key.pem')
        // fs.writeFileSync(keyFilePath, keyData)

        // create a folder with a 3 files
        filesName = ['index.html', 'index.css', 'index.js'];
        filesPath = filesName.map(file => path.join(testFolder, file))

        filesContent = ['<html><head><title>test</title></head><body><h1>test</h1></body></html>', 'body { background-color: red; }', 'console.log("test")'];

        filesPath.forEach(file => {
            fs.writeFileSync(file, filesContent[filesPath.indexOf(file)])
        })

    });

    after(() => {

    });

    it("should initialize api objects and load folder file", async () => {
        // -----------initialize api objects-----------------
        nock(endpoint)
            .post('/api', {
                query: `query {
                    nearestEndpoints {
                        ip,
                        port
                    }
                }`})
            .reply(200, nearestEndpoints);

        archethic = new Archethic(endpoint);
        await archethic.connect();
        aeweb = new AEWeb(archethic);

        aeweb.addSSLCertificate(certificateData, keyData)
        // -----------Load files from folder-----------------
        const files = cli.getFiles(testFolder)
        files.forEach(({ filePath, data }) => aeweb.addFile(filePath, data))

        // -----------verify funtionality of aeweb object-----------------
        expect(aeweb.modifiedFiles).to.have.lengthOf(filesName.length);
        expect(aeweb.modifiedFiles).deep.include.members(filesName);

        expectedMetaData = {}
        filesName.forEach((_, i) => {
            expectedMetaData[getFilePath(filesName[i])] = {
                hash: hashContent(filesContent[i]),
                size: Buffer.byteLength(filesContent[i]),
                encoding: 'gzip',
                addresses: []
            }
        });

        expect(aeweb.metaData).to.deep.equalInAnyOrder(expectedMetaData);

        expectedTxsContent = {
            size: filesContent.reduce((acc, current, i) => {
                return (zlib.gzipSync(current).toString('base64url')).length + 7 + filesName[i].length + acc;
            }, 0),
            "content":
                filesName.reduce((acc, curr, i) => {
                    acc[curr] = zlib.gzipSync(filesContent[i]).toString('base64url');
                    return acc;
                }, {}),
            "refPath": filesName
        }

        expect(aeweb.txsContent).to.deep.equalInAnyOrder([expectedTxsContent]);
    });

    it("should create valid transactions", async () => {
        transactions = aeweb.getFilesTransactions()
        expect(JSON.parse(new TextDecoder().decode(transactions[0].data.content))).to.deep.equalInAnyOrder(
            expectedTxsContent.content
        );

        transactions[0] = transactions[0].build(seeds.filesSeed, 0).originSign(originPrivateKey)

        expect(transactions[0].address).deep.equal(Crypto.deriveAddress(seeds.filesSeed, 1));

        // build ref transaction with ssl
        nock(archethic.nearestEndpoints[0])
            .post('/api', {
                query:
                    `query {
                    sharedSecrets {
                        storageNoncePublicKey
                    }
                }`
            })
            .reply(200, {
                "data": {
                    "sharedSecrets": {
                        "storageNoncePublicKey": `${storageNoncePublicKey}`
                    }
                }
            });

        const refTx = await aeweb.getRefTransaction(transactions);

        refTx.build(seeds.refSeed, 0).originSign(originPrivateKey)
        transactions.push(refTx)

        filesName.forEach((_, i) => {
            expectedMetaData[getFilePath(filesName[i])].addresses.push(Utils.maybeUint8ArrayToHex(transactions[0].address))
        });

        expect(JSON.parse((new TextDecoder()).decode(refTx.data.content))).deep.equal({
            "aewebVersion": AEWEB_VERSION,
            "hashFunction": HASH_FUNCTION,
            "metaData": expectedMetaData,
            "sslCertificate": certificateData
        });


        expect(refTx.address).deep.equal(Crypto.deriveAddress(seeds.refSeed, 1));

    });

    // it("should estimate tx fees",
    //     async () => {
    //         const fees = 10000;

    //         nock(archethic.nearestEndpoints[0])
    //             .post('/api/transaction_fee')
    //             .times(3)
    //             .reply(200, { "fee": fees, "rates": { "eur": 0.07906, "usd": 0.08349 } });

    //         const { refTxFees, filesTxFees } = await cli.estimateTxsFees(archethic, transactions)

    //         expect(refTxFees).to.deep.equal(Math.trunc(slippage * fees));

    //         expect(filesTxFees).to.deep.equal(Math.trunc(slippage * fees));

    //         const transferTx = archethic.transaction.new()
    //             .setType('transfer')
    //             .addUCOTransfer(Crypto.deriveAddress(seeds.refSeed, 0), refTxFees)
    //             .addUCOTransfer(Crypto.deriveAddress(seeds.filesSeed, 0), filesTxFees)
    //             .build(baseSeed, 2).originSign(originPrivateKey)

    //         transactions.unshift(transferTx)


    //         const { fee } = await archethic.transaction.getTransactionFee(transferTx)
    //         expect(fee).to.equal(fees)

    //         expect(nock.isDone()).to.be.true;
    //     });
});

