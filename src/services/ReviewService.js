import { db } from "@/firebase";
import { REVIEWS_COLLECTION } from "@/constants/collections";

const reviewsRef = db.collection(REVIEWS_COLLECTION);

export async function getReviews(requestName) {
  let response;
  let error;
  try {
    const snapshot = await reviewsRef
      .where("requestName", "==", requestName)
      .limit(1)
      .get();
    response = snapshot.docs[0].data();
  } catch (e) {
    error = e;
  }

  return { response, error };
}

export async function getAllReviews() {
  let response;
  let error;
  try {
    const snapshot = await reviewsRef.get();
    response = snapshot.docs.map((doc) => doc.data());
  } catch (e) {
    error = e;
  }

  return { response, error };
}

export async function getReviewByAttestationID(requestNames, attestationID) {
  let response;
  let error;
  try {
    const snapshot = await reviewsRef
      .where("requestName", "in", requestNames)
      .get();

    const requestsReviews = snapshot.docs.map((doc) => doc.data());
    const reviewObj = requestsReviews.find((requestReviews) =>
      requestReviews.reviews.some(
        (review) => review.attestationID === attestationID
      )
    );
    const attestationReview = reviewObj.reviews.find(
      (review) => review.attestationID === attestationID
    );
    response = { ...attestationReview, requestName: reviewObj.requestName };
  } catch (e) {
    error = e;
  }

  return { response, error };
}
