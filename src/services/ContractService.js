import { ElNotification } from "element-plus";
import { getAmendmentsByRefUID } from "@/services/AmendmentService";
import { getReviewByAttestationID } from "@/services/ReviewService";
import {
  DEFAULT_PAYMENT_ADDRESS,
  EAS_CONTRACT_ABI,
  EAS_CONTRACT_ADDRESS,
  ERC_20_ABI,
  PAYMENT_OPTIONS,
} from "../constants/contractConstants";
import { saveAttestationIdToDB } from "./AttestationsService";

const notificationTime = process.env.VUE_APP_NOTIFICATION_DURATION;

export const sendTransactionNotification = (txHash, title) => {
  const txURL =
    process.env.NODE_ENV === "production"
      ? `https://optimistic.etherscan.io/tx/${txHash}`
      : `https://sepolia-optimism.etherscan.io/tx/${txHash}`;

  ElNotification({
    title,
    dangerouslyUseHTMLString: true,
    message: `<a href="${txURL}" target="_blank">View Transaction</a>`,
    type: "warning",
    duration: notificationTime,
  });
};

export const getContract = async (web3, contractABI, contractAddress) => {
  return new web3.eth.Contract(contractABI, contractAddress);
};

export const createReviewForm = async (web3, contract, params) => {
  const {
    formName,
    questions,
    types,
    choices,
    contractAddress,
    walletAddress,
  } = params;
  const { methods } = contract;

  let response;

  try {
    const transactionData = methods
      .createReviewForm(formName, questions, choices, types)
      .encodeABI();

    const gasEstimate = await web3.eth.estimateGas({
      from: walletAddress,
      to: contractAddress,
      data: transactionData,
    });

    const transaction = {
      from: walletAddress,
      to: contractAddress,
      data: transactionData,
      gas: gasEstimate,
    };

    await web3.eth
      .sendTransaction(transaction)
      .on("transactionHash", (txHash) => {
        sendTransactionNotification(txHash, "Transaction in progress");
      })
      .on("receipt", (receipt) => {
        response = receipt;
      });
  } catch (e) {
    console.error("An error ocurred while creating review form.", e);
    throw e;
  }

  return response;
};

export const getReviewForm = async (params) => {
  const { contractMethods, reviewFormName } = params;
  try {
    const response = await contractMethods.getReviewForm(reviewFormName).call();

    return response;
  } catch (e) {
    console.error("An error ocurred while getting the review form.", e);
    throw e;
  }
};

export const getReviewFormsTotal = async (params) => {
  const { contractMethods } = params;
  try {
    const response = contractMethods.reviewForms().call();

    return response;
  } catch (e) {
    console.error("An error ocurred while getting the review form.", e);
    throw e;
  }
};

export const getPaymentOptions = async (params) => {
  const { contractMethods } = params;
  try {
    const response = await contractMethods.getWhitelistedTokens().call();

    let newPaymentOptions = {};

    for (let address of response) {
      if (PAYMENT_OPTIONS[address]) {
        newPaymentOptions[address] = PAYMENT_OPTIONS[address];
      } else {
        newPaymentOptions[address] = address;
      }
    }

    return newPaymentOptions;
  } catch (e) {
    console.error("An error ocurred while getting the review form.", e);
    throw e;
  }
};

export const handleRequest = async (web3, contract, params, isPaid) => {
  const {
    name,
    reviewFormName,
    targets,
    targetHashes,
    reviewers,
    reviewerContracts,
    requestHash,
    rewardPerReview,
    reviewsPerHypercert,
    totalReward,
    contractAddress,
    paymentTokenAddress,
    walletAddress,
  } = params;
  const { methods } = contract;

  let methodName = isPaid ? "createRequest" : "createNonPayableRequest";

  let methodArgs = isPaid
    ? [
        name,
        reviewers,
        reviewerContracts,
        targets,
        targetHashes,
        requestHash,
        rewardPerReview,
        reviewsPerHypercert,
        paymentTokenAddress,
        reviewFormName,
      ]
    : [
        name,
        reviewers,
        reviewerContracts,
        targets,
        targetHashes,
        requestHash,
        reviewFormName,
      ];

  let response;
  try {
    if (isPaid && paymentTokenAddress !== DEFAULT_PAYMENT_ADDRESS) {
      const tokenContract = new web3.eth.Contract(
        ERC_20_ABI,
        paymentTokenAddress
      );
      await tokenContract.methods
        .approve(contractAddress, totalReward)
        .send({ from: walletAddress });
    }

    const gasEstimate = await web3.eth.estimateGas({
      from: walletAddress,
      to: contractAddress,
      value: isPaid
        ? paymentTokenAddress === DEFAULT_PAYMENT_ADDRESS
          ? totalReward
          : 0
        : 0,
      data: methods[methodName](...methodArgs).encodeABI(),
    });

    const transaction = {
      from: walletAddress,
      to: contractAddress,
      value: isPaid
        ? paymentTokenAddress === DEFAULT_PAYMENT_ADDRESS
          ? totalReward
          : 0
        : 0,
      data: methods[methodName](...methodArgs).encodeABI(),
      gas: gasEstimate,
    };

    await web3.eth
      .sendTransaction(transaction)
      .on("transactionHash", (txHash) => {
        sendTransactionNotification(txHash, "Transaction in progress");
      })
      .on("receipt", (receipt) => {
        response = receipt;
      });
  } catch (e) {
    console.error("An error occurred while processing the request.", e);
    throw e;
  }

  return response;
};

export const getRequest = async (params) => {
  const { requestName, contractMethods } = params;
  try {
    const response = contractMethods.getRequest(requestName).call();

    return response;
  } catch (e) {
    console.error("An error ocurred while getting the request.", e);
    throw e;
  }
};

export const getRequestNames = async (params) => {
  const { contractMethods } = params;
  try {
    const response = contractMethods.getReviewRequestsNames().call();

    return response;
  } catch (e) {
    console.error("An error ocurred while getting the requests names.", e);
    throw e;
  }
};

export const isReviewer = async (params) => {
  const { contractMethods, requestName, reviewerAddress } = params;
  try {
    const response = contractMethods
      .isReviewer(reviewerAddress, requestName)
      .call();

    return response;
  } catch (e) {
    console.error("An error ocurred while getting the requests names.", e);
    throw e;
  }
};

export const closeRequest = async (web3, contract, params) => {
  const { requestName, contractAddress, walletAddress } = params;
  const { methods } = contract;

  let response;

  try {
    const transactionData = methods.closeReviewRequest(requestName).encodeABI();

    const gasEstimate = await web3.eth.estimateGas({
      from: walletAddress,
      to: contractAddress,
      data: transactionData,
    });

    const transaction = {
      from: walletAddress,
      to: contractAddress,
      data: transactionData,
      gas: gasEstimate,
    };

    await web3.eth
      .sendTransaction(transaction)
      .on("transactionHash", (txHash) => {
        sendTransactionNotification(txHash, "Transaction in progress");
      })
      .on("receipt", (receipt) => {
        response = receipt;
      });
  } catch (e) {
    console.error("An error ocurred while closing the review request.", e);
    throw e;
  }

  return response;
};

export const submitReview = async (web3, contract, params) => {
  const {
    name,
    hypercertID,
    answers,
    questions,
    questionTypes,
    attachmentsIpfsHashes,
    tokenID,
    walletAddress,
  } = params;

  const { methods } = contract;
  const { eth } = web3;

  const notes1Value = "";
  const notes2Value = "";
  const rfu1Value = [];
  const rfu2Value = [];

  const easContract = new eth.Contract(EAS_CONTRACT_ABI, EAS_CONTRACT_ADDRESS, {
    from: walletAddress,
  });

  let response;

  let attestationID;

  try {
    const requestReviewForm = await methods.getRequestReviewForm(name).call();
    const reviewsSchemaID = await methods.reviewsSchemaID().call();
    const pdfRequestData = {
      name: name,
      accountID: walletAddress,
      hypercertID: hypercertID,
      tokenID: tokenID,
      easSchemaID: reviewsSchemaID,
      questions: requestReviewForm.questions,
      questionOptions: requestReviewForm.choices,
      answers: answers,
      reviewCreatedAt: Math.floor(Date.now() / 1000),
      attachmentsIpfsHashes: attachmentsIpfsHashes,
    };
    const pdfResponse = await fetch(
      process.env.VUE_APP_CLOUD_FUNCTIONS_BASE_URL + "/api/generate_pdf",
      {
        method: "POST",
        body: JSON.stringify(pdfRequestData),
      }
    );
    const pdfData = await pdfResponse?.json();

    const ipfsHashID = pdfData?.IpfsHash;

    const abi = [
      { type: "string", name: "requestName" },
      { type: "uint256", name: "hypercertID" },
      { type: "string[]", name: "answers" },
      { type: "string[]", name: "questions" },
      { type: "string[]", name: "questionTypes" },
      { type: "string", name: "pdfIpfsHash" },
      { type: "string[]", name: "attachmentsIpfsHashes" },
      { type: "string", name: "notes1" },
      { type: "string", name: "notes2" },
      { type: "string[]", name: "rfu1" },
      { type: "string[]", name: "rfu2" },
    ];

    const encodedData = web3.eth.abi.encodeParameters(abi, [
      name,
      hypercertID,
      answers,
      questions,
      questionTypes,
      ipfsHashID,
      attachmentsIpfsHashes,
      notes1Value,
      notes2Value,
      rfu1Value,
      rfu2Value,
    ]);

    const data = await easContract.methods
      .attest({
        schema: reviewsSchemaID,
        data: {
          recipient: "0x0000000000000000000000000000000000000000",
          expirationTime: 0n,
          revocable: false,
          refUID:
            "0x0000000000000000000000000000000000000000000000000000000000000000",
          data: encodedData,
          value: 0,
        },
      })
      .encodeABI();

    const gasEstimate = await web3.eth.estimateGas({
      from: walletAddress,
      to: EAS_CONTRACT_ADDRESS,
      data: data,
    });

    const transaction = {
      from: walletAddress,
      to: EAS_CONTRACT_ADDRESS,
      data: data,
      gas: gasEstimate,
    };

    await web3.eth
      .sendTransaction(transaction)
      .on("transactionHash", (txHash) => {
        sendTransactionNotification(txHash, "Transaction in progress");
      })
      .on("receipt", (receipt) => {
        response = receipt;

        attestationID = receipt.logs[0].data;
      });
  } catch (e) {
    console.error("An error ocurred while submitting the review.", e);
    throw e;
  }

  await saveAttestationIdToDB(attestationID);

  return response;
};

export const createAmendment = async (web3, contract, params) => {
  const {
    name,
    hypercertID,
    tokenID,
    amendment,
    attachmentsIpfsHashes,
    refUID,
    walletAddress,
  } = params;

  const { methods } = contract;
  const { eth } = web3;

  const easContract = new eth.Contract(EAS_CONTRACT_ABI, EAS_CONTRACT_ADDRESS, {
    from: walletAddress,
  });

  let response;

  let attestationID;

  try {
    const amendmentsSchemaID = await methods.amendmentsSchemaID().call();
    const reviewAmendments = (await getAmendmentsByRefUID(refUID)).response;
    reviewAmendments.push({
      amendment: amendment,
      attachmentsIpfsHashes: attachmentsIpfsHashes,
      createdAt: Math.floor(Date.now() / 1000),
    });
    const amendmentReview = (await getReviewByAttestationID(tokenID, refUID))
      .response;
    const requestReviewForm = await methods.getRequestReviewForm(name).call();
    const reviewsSchemaID = await methods.reviewsSchemaID().call();
    const pdfRequestData = {
      name: name,
      accountID: walletAddress,
      hypercertID: hypercertID,
      tokenID: tokenID,
      easSchemaID: reviewsSchemaID,
      questions: requestReviewForm.questions,
      questionOptions: requestReviewForm.choices,
      answers: amendmentReview.answers,
      reviewCreatedAt: Math.floor(Date.now() / 1000),
      attachmentsIpfsHashes: amendmentReview.attachmentsIpfsHashes,
      amendments: reviewAmendments,
      attestationID: refUID,
    };

    const pdfResponse = await fetch(
      process.env.VUE_APP_CLOUD_FUNCTIONS_BASE_URL + "/api/generate_pdf",
      {
        method: "POST",
        body: JSON.stringify(pdfRequestData),
      }
    );

    const pdfData = await pdfResponse?.json();

    const pdfIpfsHash = pdfData?.IpfsHash;

    const abi = [
      { type: "string", name: "requestName" },
      { type: "uint256", name: "hypercertID" },
      { type: "string", name: "amendment" },
      { type: "string", name: "pdfIpfsHash" },
      { type: "string[]", name: "attachmentsIpfsHashes" },
    ];

    const encodedData = web3.eth.abi.encodeParameters(abi, [
      name,
      hypercertID,
      amendment,
      pdfIpfsHash,
      attachmentsIpfsHashes,
    ]);

    const data = await easContract.methods
      .attest({
        schema: amendmentsSchemaID,
        data: {
          recipient: "0x0000000000000000000000000000000000000000",
          expirationTime: 0n,
          revocable: false,
          refUID: refUID,
          data: encodedData,
          value: 0,
        },
      })
      .encodeABI();

    const gasEstimate = await web3.eth.estimateGas({
      from: walletAddress,
      to: EAS_CONTRACT_ADDRESS,
      data: data,
    });

    const transaction = {
      from: walletAddress,
      to: EAS_CONTRACT_ADDRESS,
      data: data,
      gas: gasEstimate,
    };

    await web3.eth
      .sendTransaction(transaction)
      .on("transactionHash", (txHash) => {
        sendTransactionNotification(txHash, "Transaction in progress");
      })
      .on("receipt", (receipt) => {
        response = receipt;

        attestationID = receipt.logs[0].data;
      });
  } catch (e) {
    console.error("An error ocurred while submitting the review.", e);
    throw e;
  }

  await saveAttestationIdToDB(attestationID);

  return response;
};
