import { HASH_FUNCTION, MAX_FILE_SIZE, AEWEB_VERSION, getFilePath, handleNormalFile, handleBigFile, getRefTxContent, hashContent } from '../../lib/utils.js'
import { expect } from 'chai';
describe('getFilePath/1', () => {
    it('Should returns correct file path for unix-like path', () => {
        expect(getFilePath('path/to/file.json')).to.equal('path/to/file.json');
        expect(getFilePath('path/to/file.json/')).to.equal('path/to/file.json');
        expect(getFilePath('/path/to/file')).to.equal('path/to/file');
        expect(getFilePath('/path/to/file/')).to.equal('path/to/file');
    });

    it('Should return correct file path for windows-like path', () => {
        expect(getFilePath('C:\\path\\to\\file', '\\')).to.equal('C:/path/to/file');
        expect(getFilePath('C:\\path\\to\\file\\', '\\')).to.equal('C:/path/to/file');
        expect(getFilePath('C:\\path\\to\\file.json', '\\')).to.equal('C:/path/to/file.json');
        expect(getFilePath('C:\\path\\to\\file.json\\', '\\')).to.equal('C:/path/to/file.json');
    })
})

describe('hashContent/1', () => {
    it('Should return consistent hash for same content', () => {
        expect(hashContent('')).to.equal('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    })
})

describe('handleBigFile', () => {
    it('should split content into single Transaction(tx content)', () => {
        const txsContent = [], filePath = 'path/to/file.json';
        const delimitersLength = filePath.length + 7;
        const content = 'a'.repeat(MAX_FILE_SIZE - delimitersLength);

        handleBigFile(txsContent, filePath, content);

        expect(txsContent.length).to.equal(1);
        expect(txsContent[0].size).to.lessThanOrEqual(MAX_FILE_SIZE);
        expect(txsContent[0].content[filePath]).to.equal(content.slice(0, MAX_FILE_SIZE));

    })
    it('Should splits content into multiple Transactions(tx content)', () => {
        const txsContent = [], filePath = 'path/to/file.json';
        const delimitersLength = filePath.length + 7;

        // make content one byte larger than max file size
        const content = 'a'.repeat(MAX_FILE_SIZE - delimitersLength + 1);
        handleBigFile(txsContent, filePath, content);

        expect(txsContent.length).to.equal(2);

        expect(txsContent[0].size).to.lessThanOrEqual(MAX_FILE_SIZE);
        expect(txsContent[0].content[filePath]).to.equal(content.slice(0, MAX_FILE_SIZE - delimitersLength));

        expect(txsContent[1].size).to.lessThanOrEqual('a'.length + delimitersLength);
        expect(txsContent[1].content[filePath]).to.equal('a');
    })
})

describe('handleNormalFile/3', () => {
    it("Should create a new tx Content, when transaction Array is empty", async () => {
        const txsContents = [], filePath = 'desk/work/file.png', content = 'jkldgjkwetuiop4tmc'

        handleNormalFile(txsContents, filePath, content)

        expect(txsContents[0]).deep.equal({
            content: { [filePath]: content },
            size: filePath.length + content.length + 7,
            refPath: ['desk/work/file.png']
        })

        expect(txsContents.length).to.equal(1)
    })

    it("Should use existing tx Content, when tx size limit has not reached", async () => {
        let txsContents = []
        const file1Path = "desk/work/file.png", file1Content = 'jkldgjkwetuiop4tmc';
        const file2Path = "desk/work/home_page.html", file2Content = 'encoded data';

        handleNormalFile(txsContents, file1Path, file1Content)
        handleNormalFile(txsContents, file2Path, file2Content)

        expect(txsContents.length).to.equal(1)

        expect(txsContents[0]).deep.equal({
            content: {
                [file1Path]: file1Content, [file2Path]: file2Content
            },
            size: file1Path.length + file1Content.length + 7 + file2Path.length + file2Content.length + 7,
            refPath: [file1Path, file2Path]
        })
    })

    it("Should create a new tx Content, when using a previous tx content reach a limit", async () => {
        const txsContents = [{
            content: { "desk/work/file.png": 'jkldgjkwetuiop4tmc' }, size: MAX_FILE_SIZE - 1, refPath: ["desk/work/file.png"]
        }], file2Path = "desk/work/home_page.html", file2Content = 'encoded data';

        handleNormalFile(txsContents, file2Path, file2Content)

        expect(txsContents.length).to.equal(2)

        expect(txsContents[1]).deep.equal({
            content: {
                [file2Path]: file2Content
            },
            size: file2Path.length + file2Content.length + 7,
            refPath: [file2Path]
        })
    })

    it("Should chose first fit while iterationg through all Transactions(tx Content) ", async () => {
        const file4Path = "desk/work/last_page.html", file4Content = 'encoded data';
        const txsContents = [
            {
                content: { "desk/work/file.png": 'jkldgjkwetuiop4tmc' },
                size: MAX_FILE_SIZE - 1,
                refPath: ["desk/work/file.png"],
            },
            {
                content: { "desk/work/file2.png": 'file2jkldgjkwetuiop4tmc' },
                size: MAX_FILE_SIZE - file4Content.length - file4Path.length - 7,
                refPath: ["desk/work/file2.png"]
            },
            {
                content: { "desk/work/file3.png": 'file3jkldgjkwetuiop4tmc' },
                size: 100,
                refPath: ["desk/work/file3.png"]
            }];

        handleNormalFile(txsContents, file4Path, file4Content)

        expect(txsContents.length).to.equal(3)
        expect(txsContents[1]).deep.equal(
            {
                content: { "desk/work/file2.png": 'file2jkldgjkwetuiop4tmc', [file4Path]: file4Content },
                size: MAX_FILE_SIZE,
                refPath: ["desk/work/file2.png", file4Path]
            }
        );
    })
});

describe('getRefTxContent', () => {
    let txsContent
    let transactions
    let metaData

    beforeEach(() => {
        txsContent = [
            { content: { 'file1.json': 'content1' }, size: 40, refPath: ['file1.json'] },
            { content: { 'file2.json': 'content2' }, size: 40, refPath: ['file2.json'] },
            { content: { 'file3.json': 'content3' }, size: 40, refPath: ['file3.json'] }
        ]
        transactions = [
            {
                address: new Uint8Array([0, 0, 1, 2, 'f', 4, 3]),
                data: {
                    content: { 'file1.json': 'content1' },
                }
            },
            {
                address: new Uint8Array([0, 0, 'a', 'b', 'c', 5, 6]),
                data: {
                    content: { 'file2.json': 'content2' }
                }
            }
        ]
        metaData = {
            'file1.json': { size: 40, hash: 'hash1', addresses: [] },
            'file2.json': { size: 40, hash: 'hash2', addresses: [] },
            'file3.json': { size: 40, hash: 'hash3', addresses: [] }
        }
    })

    it('should throw an error if a transaction is not built', () => {
        transactions[0].address = undefined;
        expect(() => {
            getRefTxContent(txsContent, transactions, metaData);
        }).to.throw('Transaction is not built');
    })

    it('should throw an error if a transaction content is not expected', () => {
        transactions[0].data.content = { 'file2.json': '' }
        expect(() => {
            getRefTxContent(txsContent, transactions, metaData)
        }).to.throw('Transaction content not expected')
    })

    it('should update metadata for each filePath in the transaction', () => {
        const expectedMetaData = {
            'file1.json': { size: 40, hash: 'hash1', addresses: ['00000102000403'] },
            'file2.json': { size: 40, hash: 'hash2', addresses: ['00000000000506'] },
            'file3.json': { size: 40, hash: 'hash3', addresses: [] }
        }
        const refTxContent = getRefTxContent(txsContent, transactions, metaData, "")
        expect(refTxContent).to.equal(JSON.stringify({
            aewebVersion: AEWEB_VERSION,
            hashFunction: HASH_FUNCTION,
            metaData: expectedMetaData
        }))
    })

    it('should add sslCertificate to ref object if provided', () => {
        const sslCertificate = 'certificate'
        const expectedMetaData = {
            'file1.json': { size: 40, hash: 'hash1', addresses: ['00000102000403'] },
            'file2.json': { size: 40, hash: 'hash2', addresses: ['00000000000506'] },
            'file3.json': { size: 40, hash: 'hash3', addresses: [] }
        }
        const refTxContent = getRefTxContent(txsContent, transactions, metaData, sslCertificate)
        expect(refTxContent).to.equal(JSON.stringify({
            aewebVersion: AEWEB_VERSION,
            hashFunction: HASH_FUNCTION,
            metaData: expectedMetaData,
            sslCertificate
        }))
    })
})