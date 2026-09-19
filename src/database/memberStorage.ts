import AsyncStorage from "@react-native-async-storage/async-storage";

export type Member = {
    id: string;
    name: string;
    mobile: string;
    monthlyInstallment: number;
    isActive: boolean;
    createdAt: string;
};

const MEMBERS_KEY = "mandal_members";

export const getMembers = async (): Promise<Member[]> => {
    try {
        const data = await AsyncStorage.getItem(MEMBERS_KEY);

        if (!data) {
            return [];
        }

        return JSON.parse(data);
    } catch (error) {
        console.error("Get members error:", error);
        return [];
    }
};

export const saveMembers = async (members: Member[]): Promise<void> => {
    try {
        await AsyncStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
    } catch (error) {
        console.error("Save members error:", error);
        throw error;
    }
};

export const addMember = async (
    name: string,
    mobile: string,
    monthlyInstallment: number
): Promise<Member> => {
    const members = await getMembers();

    const newMember: Member = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name,
        mobile,
        monthlyInstallment,
        isActive: true,
        createdAt: new Date().toISOString(),
    };

    // Push keeps the original add order.
    const updatedMembers = [...members, newMember];

    await saveMembers(updatedMembers);

    return newMember;
};

export const updateMember = async (
    memberId: string,
    updates: Partial<Pick<Member, "name" | "mobile" | "monthlyInstallment">>
): Promise<void> => {
    const members = await getMembers();

    const updatedMembers = members.map((member) =>
        member.id === memberId
            ? {
                ...member,
                ...updates,
            }
            : member
    );

    await saveMembers(updatedMembers);
};

export const setMemberActive = async (
    memberId: string,
    isActive: boolean
): Promise<void> => {
    const members = await getMembers();

    const updatedMembers = members.map((member) =>
        member.id === memberId
            ? {
                ...member,
                isActive,
            }
            : member
    );

    await saveMembers(updatedMembers);
};