import {View, Text, StyleSheet, Pressable} from "react-native";

export default function HomeScreen(){
    return(
        <View style={styles.container}>
            <Text style={styles.title}>LiveFit</Text>

            <Pressable style={styles.button} onPress={() =>console.log("Start Pressed")}>
                <Text style={styles.buttonText}>Start Workout</Text>
            </Pressable>
        </View>
    );
}

const styles=StyleSheet.create({
    container: {
        flex:1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#fff",
    },
    title: {
        fontSize: 28,
        fontWeight: "700",
        marginBottom: 30,
    },
    button: {
        paddingVertical: 14,
        paddingHorizontal: 30,
        backgroundColor: "#000",
    },

    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
});