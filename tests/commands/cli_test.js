import { getSeeds, loadSSL, estimateTxsFees, normalizeFolderPath, getFiles } from '../../commands/cli.js';
import * as fs from 'fs';
import Archethic from 'archethic';
import path from 'path';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);


const test_folder = "dist/";

function createFolder(folderToCreate) {
    fs.rm(folderToCreate, { recursive: true }, () => { });
    fs.mkdirSync(folderToCreate)
}
function removeFolder(folderToRemove) {
    fs.rm(folderToRemove, { recursive: true }, () => { });
}


describe('loadSSL', () => {
    const sslTestFolder = path.join(test_folder, 'ssl_tests/')

    it('should return empty object if no SSL certificate or key is provided',
        () => {
            const sslConfiguration = loadSSL(undefined, undefined)
            expect(sslConfiguration).deep.equal({})
        })

    it('should throw an error if SSL certificate file is provided but SSL key file is missing',
        () => {
            const sslCertificateFile = 'ssl/certificate.pem'
            expect(() => loadSSL(sslCertificateFile, undefined)).to.throw('SSL key file is required')
        })

    it('should throw an error if SSL key file is provided but SSL certificate file is missing',
        () => {
            const sslKeyFile = 'ssl/key.pem'
            expect(() => loadSSL(undefined, sslKeyFile)).to.throw('SSL certificate file is required')
        })

    it('should load SSL certificate and key files and return an object with "cert" and "key" properties',
        async () => {
            createFolder(sslTestFolder)

            const sslCertificateFile = path.join(sslTestFolder, 'certificate.pem')
            const certData = 'mock cert';
            const sslKeyFile = path.join(sslTestFolder, 'key.pem')
            const keyData = 'mock key';


            fs.writeFileSync(sslCertificateFile, certData)
            fs.writeFileSync(sslKeyFile, keyData)

            const sslConfiguration = loadSSL(sslCertificateFile, sslKeyFile);

            expect(sslConfiguration).deep.equal({ cert: certData, key: keyData });
            removeFolder(sslTestFolder)
        });
});

describe('getSeeds/1', () => {
    it('should return the correct refSeed and filesSeed values',
        () => {
            const baseSeed = 'ae7w8h12';

            expect(getSeeds(baseSeed)).deep.equal({
                refSeed: `${baseSeed}aeweb_ref`,
                filesSeed: `${baseSeed}aeweb_files`
            });
        });

    it('should return an object with null values if the baseSeed is null',
        () => {
            expect(() => getSeeds(null)).to.throw('Base seed is required');
        });
});

describe('normalizeFolderPath', () => {
    it('should remove the trailing path separator from the folder path',
        () => {
            let folderPath = 'C:\\Users\\John\\Documents\\';
            expect(normalizeFolderPath(folderPath, '\\')).to.equal('C:\\Users\\John\\Documents');

            folderPath = "/Users/John/Documents/";
            expect(normalizeFolderPath(folderPath)).to.equal('/Users/John/Documents');

        });

    it('should return the folder path as is if it does not end with a path separator', () => {
        let folderPath = 'C:\\Users\\John\\Pictures';
        expect(normalizeFolderPath(folderPath, '\\')).to.equal('C:\\Users\\John\\Pictures');

        folderPath = "/Users/John/Documents";
        expect(normalizeFolderPath(folderPath)).to.equal('/Users/John/Documents');
    });


    it('should return an empty string if the folder path is empty',
        () => {
            const folderPath = '';
            const result = normalizeFolderPath(folderPath);
            expect(result).to.equal('.');
        });

    it('should throw null if the folder path is null',
        () => {
            expect(() => normalizeFolderPath(null)).to.throw(`Cannot read properties of null (reading 'endsWith')`);
        });
});

describe('estimateTxsFees', () => {

    it('should handle an empty list of transactions',
        async () => {
            const archethic = new Archethic(new URL(`https://testnet.archethic.net/`).origin);
            await expect(estimateTxsFees(archethic, [])).to.be.rejectedWith("No transactions to estimate fees")
        });
});

describe('getFiles/2', () => {
    const cliTestFolder = path.join(test_folder, 'cli_tests/')

    it("should throw Bad Folder Path", () => {
        expect(() => getFiles("")).to.throw('Bad Folder Path')

        expect(() => getFiles(undefined)).to.throw("Bad Folder Path");

        expect(() => getFiles(10)).to.throw("Bad Folder Path");
    });

    it("should return an array of file path and file data from the folder", async () => {
        createFolder(cliTestFolder)


        const file1Path = path.join(cliTestFolder, 'afile1.txt')
        const file1Data = "some notes for test data"
        const file2Path = path.join(cliTestFolder, 'bfile2.html')
        const file2Data = "index.html"


        fs.writeFileSync(file1Path, file1Data)
        fs.writeFileSync(file2Path, file2Data)
        const files = getFiles(cliTestFolder)

        expect(Array.isArray(files)).to.equal(true)
        expect(files).deep.equal([
            { "filePath": "/afile1.txt", "data": Buffer.from(file1Data) },
            { "filePath": "/bfile2.html", "data": Buffer.from(file2Data) }
        ]);

        removeFolder(cliTestFolder)
    });

});