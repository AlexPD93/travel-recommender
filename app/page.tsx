/* eslint-disable react-hooks/purity */
"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, addDoc, serverTimestamp, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";

const FormSchema = z.object({
  username: z.string().min(2),
  age: z.string().min(1),
  style: z.string().min(3),
  activity: z.string().min(3),
});

type FormData = z.infer<typeof FormSchema>;

export default function Page() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      username: "",
      age: "",
      style: "",
      activity: "",
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [timeline, setTimeline] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, "recommendations"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setTimeline(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const onSubmit = async (data: FormData) => {
    // 1) call server route to get city
    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      alert("Recommendation failed: " + (json.error ?? "unknown"));
      return;
    }
    const city = json.city ?? "Unknown";
    const country = json.country ?? "Unknown";
    const recommendation = json.recommendation ?? "Unknown";

    // 2) save to Firestore
    await addDoc(collection(db, "recommendations"), {
      username: data.username,
      age: data.age,
      style: data.style,
      activity: data.activity,
      city,
      country,
      recommendation,
      createdAt: serverTimestamp(),
    });

    reset();
  };

  const capitaliseFirstLetter = (sentence: string) => {
    const sentenceLength = sentence.length
     const capitalisedFirstLetter = sentence[0].toLocaleUpperCase()
     const restOfSentence = sentence.slice(1, sentenceLength)
     const capitalisedSentence = capitalisedFirstLetter + restOfSentence
     return capitalisedSentence
  }

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Travel Recommender</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 mb-6">

            {/* Username */}
            <div className="flex flex-col">
              <label htmlFor="username" className="mb-1 font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                {...register("username")}
                className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Enter your username"
              />
              {errors.username && (
                <p className="text-red-500 mt-1 text-sm">{errors.username.message}</p>
              )}
            </div>

            {/* Age */}
            <div className="flex flex-col">
              <label htmlFor="age" className="mb-1 font-medium text-gray-700">
                Age
              </label>
              <input
                id="age"
                {...register("age")}
                className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Enter your age"
              />
              {errors.age && (
                <p className="text-red-500 mt-1 text-sm">{errors.age.message}</p>
              )}
            </div>

            {/* Favourite style */}
            <div className="flex flex-col">
              <label htmlFor="style" className="mb-1 font-medium text-gray-700">
                Travel style
              </label>
              <input
                id="style"
                {...register("style")}
                className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Enter your travel style e.g. 'Relaxed'"
              />
              {errors.style && (
                <p className="text-red-500 mt-1 text-sm">{errors.style.message}</p>
              )}
            </div>

            {/* Favourite Activity */}
            <div className="flex flex-col">
              <label htmlFor="activity" className="mb-1 font-medium text-gray-700">
                Favourite Activity
              </label>
              <input
                id="activity"
                {...register("activity")}
                className="border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Enter your favourite activity"
              />
              {errors.activity && (
                <p className="text-red-500 mt-1 text-sm">{errors.activity.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors"
            >
              {isSubmitting ? "Thinking..." : "Submit"}
            </button>
      </form>

      <section>
        <h2 className="text-xl font-semibold mb-2">Timeline</h2>
        <ul className="space-y-3">
          {timeline.map((item) => (
            <li key={item.id} className="border p-3 rounded shadow-sm">
              <div className="text-sm text-gray-500">{new Date(item.createdAt?.toDate?.() ?? Date.now()).toLocaleString()}</div>
              <div className="font-medium">{item.username} → <span className="text-indigo-600">{capitaliseFirstLetter(item.city)}, {capitaliseFirstLetter(item.country)}</span></div>
              <div className="text-sm">Age: {item.age} • Travel style: {capitaliseFirstLetter(item.style)} • Activity: {capitaliseFirstLetter(item.activity)}</div>
              <div className="text-sm">{item.recommendation}</div>
            </li>
          ))}
          {timeline.length === 0 && <li className="text-gray-500">No recommendations yet.</li>}
        </ul>
      </section>
    </main>
  );
}
