const fs = require("fs");
const archethic = require("archethic");
const originPrivateKey =
  "01009280BDB84B8F8AEDBA205FE3552689964A5626EE2C60AA10E3BF22A91A036009";
const chalk = require("chalk");
const mime = require("mime");
const path = require("path");
const crypto = require("crypto");
const algo = "sha256";
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const yesno = require("yesno");


exports.command = "deploy-website";

exports.describe =
  "Deploy all files inside folder and target index.html file to automatically convert filepaths to transactions";

exports.builder = {
  seed: {
    describe:
      "Seed is a string representing the transaction chain entropy to be able to derive and generate the keys for the transactions",
    demandOption: true, // Required
    type: "string",
  },

  endpoint: {
    describe:
      "Endpoint is the URL of a welcome node to receive the transaction",
    demandOption: true, // Required
    type: "string",
  },

  folder: {
    describe: "Folder is the name of folder",
    demandOption: true, // Required
    type: "string",
  },
};

exports.handler = async function (argv) {
  const path_struct = {};
  const node_endpoint = argv.endpoint;

  function ReadDirectory(Directory) {
    try {
      fs.readdirSync(Directory).forEach((File) => {
        const abs = path.join(Directory, File);

        if (fs.statSync(abs).isDirectory()) return ReadDirectory(abs);
        else {
          if (Directory !== argv.folder) {
            const key = Directory.replace(argv.folder + "/", "") + "/" + File;
            function pathStructure(filePath) {
              {
                seed: "",
                address: "",
                full_file_path: filePath
              }
             }
          }
        }
      });
    } catch (e) {
      console.error(e.message);
      return;
    }
  }

  (async () => {
    // Read Dir and Created a files
    ReadDirectory(argv.folder);

    // Here we have a Files array with all file names
    const Files = Object.keys(path_struct);

    for (let i = 0; i < Files.length; i++) {
      const seed = crypto
        .createHmac(algo, argv.seed)
        .update(path_struct[Files[i]].full_file_path)
        .digest("hex");

      path_struct[Files[i]].seed = seed;
      const address = archethic.deriveAddress(seed, 0);

      path_struct[Files[i]].address = address;
    }

    console.log(Object.keys(path_struct).length);
    // Seeds and Addresses Generated for all file paths

    // Transfer 1 UCO to all above generated addresses

    let tx = archethic.newTransactionBuilder("transfer");

    // Add a UCO Transfer to all the addresses generated in above step for 1.0 UCO.
    Object.keys(path_struct).forEach((key) => {
      tx.addUCOTransfer(path_struct[key].address, 1.0);
    });

    // Build the transaction with root seed given by the user and sign the transaction with origin private key.
    let txn = tx.build(argv.seed, 0).originSign(originPrivateKey);

    // Send the transaction to user provided endpoint.
    try {
      await archethic.sendTransaction(txn, node_endpoint);
    } catch (e) {
      console.error(e.message);
      return;
    }

    const creatednewFiles = new Promise(async (resolve, reject) => {
      let keys = Object.keys(path_struct);
      for (let i = 0; i < keys.length; ++i) {
        const file_obj = path_struct[keys[i]];
        if (file_obj.full_file_path.includes(".html")) {
          const dom = await JSDOM.fromFile(file_obj.full_file_path);

          var nodelist = dom.window.document.querySelectorAll("[src],[href]");

          for (let i = 0; i < nodelist.length; ++i) {
            var item = nodelist[i];

            let src = item.getAttribute("src");
            let href = item.getAttribute("href");

            if (src || href) {
              if (src !== null && src in path_struct) {
                const link =
                  node_endpoint +
                  "/api/last_transaction/" +
                  path_struct[src].address +
                  "/content?mime=" +
                  mime.getType(src);

                item.setAttribute("src", link);
              }

              if (href !== null && href in path_struct) {
                const link =
                  node_endpoint +
                  "/api/last_transaction/" +
                  path_struct[href].address +
                  "/content?mime=" +
                  mime.getType(href);

                item.setAttribute("href", link);
              }
            }

            data = dom.serialize();

            try {
              fs.writeFileSync(file_obj.full_file_path, data);
            } catch (err) {
              console.error(err);
            }
          }
        }
      }

      resolve(path_struct);
    });

    creatednewFiles.then(async (res) => {
      const keys = Object.keys(res);
      console.log(chalk.bgRed("Total File Found: " + keys.length));

      let tfee = 0;
      let eur = 0;
      let usd = 0;

      let allTransactions = [];
      for (let i = 0; i < keys.length; ++i) {
        console.log(res[keys[i]]);
        const content = fs.readFileSync(res[keys[i]].full_file_path);
        let index;
        const txBuilder = archethic
          .newTransactionBuilder("hosting")
          .setContent(content);

        try {
          index = await archethic.getTransactionIndex(
            res[keys[i]].address,
            node_endpoint
          );
        } catch (e) {
          console.error(e.message);
          return;
        }

        // This transaction is sent via seed for file path generated seed not from user supplied seed.
        let transaction = txBuilder
          .build(res[keys[i]].seed, index)
          .originSign(originPrivateKey);

        const { fee: fee, rates: rates } = await archethic.getTransactionFee(
          transaction,
          node_endpoint
        );

        tfee += fee;
        usd += rates.usd;
        eur += rates.eur;

        allTransactions.push(transaction);
      }

      const ok = await yesno({
        question:
          "Total Fee Requirement would be : " +
          tfee.toFixed(2) +
          " UCO ( $ " +
          usd.toFixed(2) +
          " | € " +
          eur.toFixed(2) +
          " ). Do you want to continue. (yes/no)",
      });

      if (ok) {
        let keys = Object.keys(path_struct);
        allTransactions.forEach(async (transaction, index) => {
          archethic.waitConfirmations(
            transaction.address,
            node_endpoint,
            function (nbConfirmations) {
              if (nbConfirmations == 1) {
                console.log(
                  "Created at File URI at Address: ",
                  path_struct[keys[index]].address
                );
              }
            }
          );
          try {
            await archethic.sendTransaction(transaction, node_endpoint);
          } catch (e) {
            console.error(e);
          }
        });
        console.log(
          "Website is deployed at: ",
          node_endpoint +
            "/api/last_transaction/" +
            path_struct["index.html"].address +
            "/content?mime=text/html"
        );
      } else {
        console.log("User aborted the Transactions.");
      }
    });
  })();
};
