import { setStatusBarBackgroundColor } from "expo-status-bar";
import {View, Text, StyleSheet, Pressable} from "react-native";

export default function FitnessScreen(){
    return(
        <View style={styles.container}>
            <Text style={styles.title}>Select Activity</Text>

            <Pressable style={styles.card}>
                <Text style={styles.cardText}>Running</Text>
            </Pressable>
        </View>
    );
}

const styles=StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        fontSize: 24,
        fontWeight: "700",
        marginBottom: 30,
    },
    card: {
        width: "80%",
        paddingVertical: 18,
        backgroundColor: "#000",
        borderRadius: 12,
        alignItems: "center",
    },
    cardText: {
        color: "#fff",
        fontSize: 18,
        fontWeight: "600",
    },
});