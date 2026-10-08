# Data 4 Wildlife Hackathon 🛠️
**Hackathon (29-30 Jan 2022) based on developing a digital solution to prevent illegal wildlife trade (IWT) on online social platforms.**

* **Team** - Sean P. Rogers, Gabriela Youngken  👩‍🎓 👨‍🎓
* **Mentor** - Alastair Jamieson 👨‍🏫 (also API-keys holder 👛)

### **Challenge** 
* To build a **benchmark dataset** of possible instances of IWT & related information from online social platforms which could also be searched and analyzed 🔚 
* According to challenge guidelines : [Challenge1_Guidelines](https://github.com/prak112/data4wildlife/files/8005154/Challenge.1.Guidance.Document.pdf)
    * _A benchmark dataset is a public dataset which is designed and collected for studying real-world data science/research problems._ 
    * _The benchmark dataset should be social media platform agnostic, as IWT happens across multiple platforms such as Instagram and YouTube._

## Our Task 
* **Collect instagram posts with images related to _Slow Loris_ hashtags (slowloris, slowlorisforsale) to build a benchmark dataset** 🏛️

* **Task Duration** - 26 hours 🏃⏲️


## Our Approach 🏗️
- Manually identify _Slow Loris_ hashtags 🐵 for example data
- Call instagram api (RapidAPI, instagram85) for hashtag related feed 
- Collect json (first page only), extract images & label images by user id
- Save images in folder labelled by language (_see **Future Prospects**_)
- Iterate api calls & collect images 
- Import json to webpage, [index.html](app/index.html), for human validation of images
- Manually validate images and export csv file with information from comments

### Future Prospects 👀
- Call api recursively with 'next_page_id' to collect all pages
- Depending on image volume, project can evolve into Image Recognition for automation

 ## _Key Takeaways_
 * _Focus on the bigger picture_ 🌄
 * _Build one-block-at-a-time_ 🧱
 * _Have consistent breaks_ 😌

