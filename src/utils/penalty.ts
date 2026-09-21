export type PenaltyResult = {
    penalty: number;
    totalDue: number;
};

export const calculatePenalty = (
    installment: number,
    paymentDate: Date
): PenaltyResult => {
    const day = paymentDate.getDate();

    let penaltyPercentage = 0;

    if (day >= 16 && day <= 20) {
        penaltyPercentage = 0.2;
    } else if (day >= 21 && day <= 25) {
        penaltyPercentage = 0.4;
    } else if (day >= 26) {
        penaltyPercentage = 0.6;
    }

    const penalty =
        installment * penaltyPercentage;

    const totalDue =
        installment + penalty;

    return {
        penalty,
        totalDue,
    };
};